import { z } from "zod";
import {
  CALL_TIMEOUT_MS,
  ENGINE_VERSION,
  INITIAL_BACKOFF_MS,
  MAX_RETRIES,
} from "../config/models";
import {
  CallAExtractResponse,
  CallAExtractResponseSchema,
  CallBVerifyResponse,
  CallBVerifyResponseSchema,
  CallEExplainResponse,
  CallEExplainResponseSchema,
} from "./extract";
import { DeterministicEngineOutput } from "./engine";
import { SupportedLanguage } from "./i18n";
import { NormalizedTestValue } from "./normalize";
import { ProcessedPageImage } from "./ocr";

/**
 * Client-side AI Orchestration client for Milo.
 * All requests go to our secure server-side endpoints (/api/gemini/*) so the API key
 * is never exposed in the browser, URLs, or logs.
 *
 * Reliability contract for every call:
 * - AbortController timeout 60s
 * - Retry up to 2 times with exponential backoff on 429/5xx
 * - Validate JSON with Zod
 * - One automatic repair attempt on invalid JSON
 * - Cache Call E results keyed by hash of (confirmed values + language + engine version)
 */

async function fetchWithRetryAndTimeout(
  url: string,
  payload: unknown,
  timeoutMs = CALL_TIMEOUT_MS
): Promise<any> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (response.status === 429 || response.status >= 500) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(
          errBody.error || `Server returned status ${response.status}. Retrying...`
        );
      }

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.error || `Request failed (${response.status})`);
      }

      return await response.json();
    } catch (err: any) {
      clearTimeout(timer);
      lastError =
        err?.name === "AbortError"
          ? new Error("Request timed out after 60 seconds. Please tap Retry.")
          : err instanceof Error
            ? err
            : new Error(String(err));

      if (attempt < MAX_RETRIES) {
        const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw lastError || new Error("Network error while communicating with Milo AI.");
}

/**
 * Validates raw JSON data against a Zod schema; if validation fails, performs one automatic
 * server-side JSON repair attempt before throwing a friendly error.
 */
async function validateWithRepair<T>(
  rawData: unknown,
  schema: z.ZodType<T>,
  schemaDescription: string
): Promise<T> {
  const firstTry = schema.safeParse(rawData);
  if (firstTry.success) {
    return firstTry.data;
  }

  // One automatic repair attempt
  const repaired = await fetchWithRetryAndTimeout("/api/gemini/repair-json", {
    brokenJson: typeof rawData === "string" ? rawData : JSON.stringify(rawData),
    zodIssueSummary: firstTry.error.message,
    schemaDescription,
  });

  const secondTry = schema.safeParse(repaired.data);
  if (secondTry.success) {
    return secondTry.data;
  }

  throw new Error(
    "We could not structure all fields automatically from this image. Please retry or use the editable table below."
  );
}

/**
 * Call A: Extract (PRO, vision + PDF text layer, structured output)
 */
export async function callAExtractPage(
  page: ProcessedPageImage,
  mode: "report" | "monitor" = "report"
): Promise<CallAExtractResponse> {
  const res = await fetchWithRetryAndTimeout("/api/gemini/extract", {
    base64Data: page.base64Data,
    mimeType: page.mimeType,
    extractedPdfText: page.extractedPdfText || "",
    pageNumber: page.pageNumber,
    mode,
  });

  return validateWithRepair(
    res.data,
    CallAExtractResponseSchema,
    "CallAExtractResponse { reportDate, labName, documentType, pathologyTerms, tests: [{canonicalName, nameAsPrinted, value, unit, refLow, refHigh, flag, confidence, page}] }"
  );
}

/**
 * Call B: Verify (PRO, structured output)
 * Re-reads the same image and returns only values that disagree with Call A or look implausible.
 */
export async function callBVerifyPage(
  page: ProcessedPageImage,
  callAResult: CallAExtractResponse
): Promise<CallBVerifyResponse> {
  const res = await fetchWithRetryAndTimeout("/api/gemini/verify", {
    base64Data: page.base64Data,
    mimeType: page.mimeType,
    pageNumber: page.pageNumber,
    callATests: callAResult.tests,
  });

  return validateWithRepair(
    res.data,
    CallBVerifyResponseSchema,
    "CallBVerifyResponse { discrepancies: [{nameAsPrinted, callAValue, verifiedValue, verifiedUnit, reason, isImplausibleOrUncertain}] }"
  );
}

/**
 * Computes a deterministic cache key hash for Call E (confirmed values + language + engine version).
 */
export function computeExplainCacheKey(
  values: NormalizedTestValue[],
  language: SupportedLanguage
): string {
  const canonicalPayload = values
    .map((v) => `${v.canonicalName}:${v.value}:${v.unit}`)
    .sort()
    .join("|");
  const raw = `${ENGINE_VERSION}::${language}::${canonicalPayload}`;
  let hash = 5381;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash * 33) ^ raw.charCodeAt(i);
  }
  return `explain_${(hash >>> 0).toString(16)}`;
}

/**
 * Call E: Explain (PRO, structured output)
 * Input: confirmed values + deterministic engine output + language.
 * Never invents numbers, diagnoses, drug names, or doses.
 */
export async function callEExplainReport(params: {
  confirmedValues: NormalizedTestValue[];
  engineOutput: DeterministicEngineOutput;
  pathologyTerms?: { term: string; contextAsPrinted: string }[];
  language: SupportedLanguage;
  cache: Record<string, CallEExplainResponse>;
  onCacheSave?: (key: string, val: CallEExplainResponse) => void;
}): Promise<CallEExplainResponse> {
  const cacheKey = computeExplainCacheKey(params.confirmedValues, params.language);
  if (params.cache[cacheKey]) {
    return params.cache[cacheKey];
  }

  const res = await fetchWithRetryAndTimeout("/api/gemini/explain", {
    confirmedValues: params.confirmedValues.map((v) => ({
      canonicalName: v.canonicalName,
      displayName: v.displayName,
      value: v.value,
      unit: v.unit,
      refLow: v.refLow,
      refHigh: v.refHigh,
    })),
    engineOutput: params.engineOutput,
    pathologyTerms: params.pathologyTerms || [],
    language: params.language,
  });

  const validated = await validateWithRepair(
    res.data,
    CallEExplainResponseSchema,
    "CallEExplainResponse { summary, whyItHappens, organNotes: {eyes, kidneys, nerves, heart}, roadmap: [{timeframe, title, detail}], doctorQuestions, glossaryTerms: [{term, plainMeaning}], cancerExplainer?, sevenDayPlan? }"
  );

  if (params.onCacheSave) {
    params.onCacheSave(cacheKey, validated);
  }

  return validated;
}

/**
 * Call F: Chat "Ask Milo" (FLASH, with Google Search grounding, plain text, streaming SSE)
 */
export interface GroundedSourceLink {
  title: string;
  uri: string;
}

export async function streamAskMiloChat(params: {
  question: string;
  language: SupportedLanguage;
  confirmedSummaryContext: string;
  history: { role: "user" | "model"; text: string }[];
  onChunk: (textSoFar: string) => void;
  onSources: (sources: GroundedSourceLink[]) => void;
  signal?: AbortSignal;
}): Promise<{ fullText: string; sources: GroundedSourceLink[] }> {
  const response = await fetch("/api/gemini/chat-stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question: params.question,
      language: params.language,
      confirmedSummaryContext: params.confirmedSummaryContext,
      history: params.history,
    }),
    signal: params.signal,
  });

  if (!response.ok || !response.body) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || "Could not connect to Ask Milo chat.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";
  let sources: GroundedSourceLink[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const jsonStr = line.slice(6).trim();
      if (jsonStr === "[DONE]") continue;
      try {
        const evt = JSON.parse(jsonStr);
        if (evt.type === "text" && evt.delta) {
          fullText += evt.delta;
          params.onChunk(fullText);
        } else if (evt.type === "sources" && Array.isArray(evt.sources)) {
          sources = evt.sources;
          params.onSources(sources);
        } else if (evt.type === "error") {
          throw new Error(evt.error);
        }
      } catch (e) {
        if (e instanceof Error && e.message !== "Unexpected end of JSON input") {
          // ignore partial JSON parse noise
        }
      }
    }
  }

  return { fullText, sources };
}

/**
 * Real-time Google Maps Grounding Agent call (/api/gemini/maps-agent)
 * Returns plain-language place/route guidance + official Google Maps place links and review snippets.
 */
export interface MapsGroundingPlaceLink {
  title: string;
  uri: string;
  reviewSnippets?: string[];
}

export async function queryMapsHealthAgent(params: {
  query: string;
  lat: number;
  lng: number;
  language: SupportedLanguage;
}): Promise<{
  answer: string;
  mapLinks: MapsGroundingPlaceLink[];
}> {
  const res = await fetchWithRetryAndTimeout("/api/gemini/maps-agent", params);
  return {
    answer: res.answer || "",
    mapLinks: Array.isArray(res.mapLinks) ? res.mapLinks : [],
  };
}

/**
 * Gemini Omni Flash Image-to-Video Animation (/api/gemini/animate-video)
 * Animates a product photo, healthy plate photo, or wellness mascot character into video.
 * If the API key does not have paid Omni Flash access enabled, returns `fallbackUsed: true`
 * with AI-generated motion keyframes so the client renders a real downloadable WebM video!
 */
export interface AnimateVideoResponse {
  videoBase64?: string;
  mimeType?: string;
  fallbackUsed: boolean;
  fallbackReason?: string;
  storyboardPlan?: {
    headline: string;
    subheadline: string;
    callToAction: string;
    accentColor: string;
    cameraMotion: "zoom_in" | "pan_right" | "float_character" | "cinematic_reveal";
    keyframes: { timeSec: number; caption: string; badge: string }[];
  };
}

export async function animateImageWithOmniFlash(params: {
  base64Image: string;
  mimeType: string;
  prompt: string;
  mode: "product_ad" | "character_animate" | "wellness_visual";
  aspectRatio: "16:9" | "9:16";
}): Promise<AnimateVideoResponse> {
  return await fetchWithRetryAndTimeout("/api/gemini/animate-video", params, 120_000);
}
