/**
 * Central Gemini model configuration for Milo.
 * All Gemini calls run server-side via /api/gemini/* endpoints.
 * Do NOT set temperature, topP, or topK (deprecated on newest Gemini models).
 */

export const MODELS = {
  PRO: "gemini-pro-latest",
  FLASH: "gemini-flash-latest",
  FALLBACK_FLASH: "gemini-3.8-flash",
  FALLBACK_FLASH_LITE: "gemini-3.1-flash-lite",
} as const;

export const ENGINE_VERSION = "2026.11.1-deterministic";

export const CALL_TIMEOUT_MS = 60_000;
export const MAX_RETRIES = 2;
export const INITIAL_BACKOFF_MS = 1_200;
