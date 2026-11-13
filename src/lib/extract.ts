import { z } from "zod";
import { normalizeExtractedTests, normalizeIndianDate, NormalizedTestValue, RawExtractedTest } from "./normalize";

/**
 * Zod schemas for AI Orchestration Calls A, B, and E.
 */

export const DocumentTypeSchema = z.enum([
  "blood",
  "lipid",
  "kidney",
  "BP-reading",
  "imaging",
  "pathology/biopsy",
  "other",
]);

export type DocumentType = z.infer<typeof DocumentTypeSchema>;

export const ExtractedTestItemSchema = z.object({
  canonicalName: z.string().optional().default("other"),
  nameAsPrinted: z.string(),
  value: z.number(),
  unit: z.string().default(""),
  refLow: z.number().nullable().optional().default(null),
  refHigh: z.number().nullable().optional().default(null),
  flag: z.string().optional().default("N"),
  confidence: z.number().min(0).max(1).default(0.9),
  page: z.number().int().min(1).default(1),
});

export const CallAExtractResponseSchema = z.object({
  reportDate: z.string().optional().default(""),
  labName: z.string().optional().default("Clinical Laboratory"),
  documentType: DocumentTypeSchema.optional().default("blood"),
  pathologyTerms: z
    .array(
      z.object({
        term: z.string(),
        contextAsPrinted: z.string(),
      })
    )
    .optional()
    .default([]),
  tests: z.array(ExtractedTestItemSchema),
});

export type CallAExtractResponse = z.infer<typeof CallAExtractResponseSchema>;

export const CallBDiscrepancySchema = z.object({
  nameAsPrinted: z.string(),
  callAValue: z.number().optional(),
  verifiedValue: z.number().nullable().optional(),
  verifiedUnit: z.string().optional(),
  reason: z.string(),
  isImplausibleOrUncertain: z.boolean().default(true),
});

export const CallBVerifyResponseSchema = z.object({
  discrepancies: z.array(CallBDiscrepancySchema).default([]),
});

export type CallBVerifyResponse = z.infer<typeof CallBVerifyResponseSchema>;

export const CallEExplainResponseSchema = z.object({
  summary: z.string(),
  whyItHappens: z.string(),
  organNotes: z.object({
    eyes: z.string(),
    kidneys: z.string(),
    nerves: z.string(),
    heart: z.string(),
  }),
  roadmap: z.array(
    z.object({
      timeframe: z.string(),
      title: z.string(),
      detail: z.string(),
    })
  ),
  doctorQuestions: z.array(z.string()),
  glossaryTerms: z.array(
    z.object({
      term: z.string(),
      plainMeaning: z.string(),
    })
  ),
  cancerExplainer: z
    .object({
      stageOrGradePlainMeaning: z.string(),
      typicalNextStepConversations: z.array(z.string()),
      sideEffectAwareness: z.array(z.string()),
      oncologistQuestions: z.array(z.string()),
    })
    .optional(),
  sevenDayPlan: z
    .array(
      z.object({
        day: z.string(),
        breakfast: z.string(),
        lunch: z.string(),
        eveningSnack: z.string(),
        dinner: z.string(),
        movementAndSleep: z.string(),
      })
    )
    .optional(),
});

export type CallEExplainResponse = z.infer<typeof CallEExplainResponseSchema>;

/**
 * Merges Call A (Initial Extraction) and Call B (Verification Pass) results,
 * marking any disagreed or uncertain value as `needsCheck: true` ("needs your check"),
 * then runs Code Step C (`normalizeExtractedTests`).
 */
export function mergeAndNormalizeExtraction(
  pagesCallA: CallAExtractResponse[],
  pagesCallB: CallBVerifyResponse[]
): {
  reportDate: string;
  labName: string;
  documentType: DocumentType;
  pathologyTerms: { term: string; contextAsPrinted: string }[];
  normalizedValues: NormalizedTestValue[];
} {
  const allRawTests: RawExtractedTest[] = [];
  let reportDate = "";
  let labName = "Clinical Laboratory";
  let documentType: DocumentType = "blood";
  const pathologyTerms: { term: string; contextAsPrinted: string }[] = [];

  pagesCallA.forEach((pageA, pageIndex) => {
    if (pageA.reportDate && !reportDate) reportDate = pageA.reportDate;
    if (pageA.labName && pageA.labName !== "Clinical Laboratory") labName = pageA.labName;
    if (pageA.documentType && pageA.documentType !== "blood") documentType = pageA.documentType;
    if (pageA.pathologyTerms?.length) {
      pathologyTerms.push(...pageA.pathologyTerms);
    }

    const verifyPage = pagesCallB[pageIndex];
    const discrepancyList = verifyPage?.discrepancies ?? [];

    for (const test of pageA.tests) {
      const matchingDiscrepancy = discrepancyList.find(
        (d) =>
          d.nameAsPrinted.toLowerCase().trim() === test.nameAsPrinted.toLowerCase().trim() ||
          d.nameAsPrinted.toLowerCase().includes(test.nameAsPrinted.toLowerCase())
      );

      if (matchingDiscrepancy) {
        allRawTests.push({
          ...test,
          value:
            matchingDiscrepancy.verifiedValue !== null &&
            matchingDiscrepancy.verifiedValue !== undefined
              ? matchingDiscrepancy.verifiedValue
              : test.value,
          unit: matchingDiscrepancy.verifiedUnit || test.unit,
          confidence: Math.min(test.confidence, 0.65),
          needsCheck: true,
          verifyNote: `Verification check: ${matchingDiscrepancy.reason}`,
        });
      } else {
        allRawTests.push({
          ...test,
          needsCheck: test.confidence < 0.82,
        });
      }
    }
  });

  const normalizedValues = normalizeExtractedTests(allRawTests);

  return {
    reportDate: normalizeIndianDate(reportDate),
    labName,
    documentType,
    pathologyTerms,
    normalizedValues,
  };
}

/**
 * Clearly marked Sample Reports for instant exploration ("Try a sample report").
 */
export interface SampleReportPreset {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  reportDate: string;
  labName: string;
  documentType: DocumentType;
  pathologyTerms?: { term: string; contextAsPrinted: string }[];
  rawTests: RawExtractedTest[];
}

export const SAMPLE_REPORTS: SampleReportPreset[] = [
  {
    id: "sample-diabetes-kidney",
    title: "Sample 1: Comprehensive Diabetes, Lipid & Kidney Panel",
    subtitle: "Clearly marked sample report — Delhi NCR Diagnostics format (HbA1c 7.6%, FBS 148, BP 138/86, Creatinine 1.18)",
    badge: "SAMPLE REPORT",
    reportDate: "15/10/2026",
    labName: "Sample — MetroPath Diagnostics (New Delhi)",
    documentType: "blood",
    rawTests: [
      {
        canonicalName: "hba1c",
        nameAsPrinted: "Glycosylated Hemoglobin (HbA1c - HPLC)",
        value: 7.6,
        unit: "%",
        refLow: 4.0,
        refHigh: 5.6,
        flag: "H",
        confidence: 0.98,
        page: 1,
      },
      {
        canonicalName: "fasting_glucose",
        nameAsPrinted: "Blood Sugar Fasting (FBS)",
        value: 148,
        unit: "mg/dL",
        refLow: 70,
        refHigh: 99,
        flag: "H",
        confidence: 0.97,
        page: 1,
      },
      {
        canonicalName: "pp_glucose",
        nameAsPrinted: "Glucose Post Prandial (2 Hr PPBS)",
        value: 214,
        unit: "mg/dL",
        refLow: 70,
        refHigh: 139,
        flag: "H",
        confidence: 0.96,
        page: 1,
      },
      {
        canonicalName: "systolic_bp",
        nameAsPrinted: "Clinic Seated BP - Systolic",
        value: 138,
        unit: "mmHg",
        refLow: 90,
        refHigh: 119,
        flag: "H",
        confidence: 0.95,
        page: 1,
      },
      {
        canonicalName: "diastolic_bp",
        nameAsPrinted: "Clinic Seated BP - Diastolic",
        value: 86,
        unit: "mmHg",
        refLow: 60,
        refHigh: 79,
        flag: "H",
        confidence: 0.95,
        page: 1,
      },
      {
        canonicalName: "ldl_cholesterol",
        nameAsPrinted: "LDL Cholesterol (Direct)",
        value: 142,
        unit: "mg/dL",
        refLow: 0,
        refHigh: 99,
        flag: "H",
        confidence: 0.96,
        page: 1,
      },
      {
        canonicalName: "hdl_cholesterol",
        nameAsPrinted: "HDL Cholesterol",
        value: 38,
        unit: "mg/dL",
        refLow: 40,
        refHigh: 60,
        flag: "L",
        confidence: 0.96,
        page: 1,
      },
      {
        canonicalName: "triglycerides",
        nameAsPrinted: "Serum Triglycerides",
        value: 194,
        unit: "mg/dL",
        refLow: 0,
        refHigh: 149,
        flag: "H",
        confidence: 0.95,
        page: 1,
      },
      {
        canonicalName: "creatinine",
        nameAsPrinted: "S. Creatinine (Enzymatic)",
        value: 1.18,
        unit: "mg/dL",
        refLow: 0.7,
        refHigh: 1.2,
        flag: "N",
        confidence: 0.78, // Intentionally <0.82 so user experiences confirming a flagged row!
        needsCheck: true,
        verifyNote: "Slightly faint decimal print on page 1 — please confirm 1.18 mg/dL.",
        page: 1,
      },
      {
        canonicalName: "urine_acr",
        nameAsPrinted: "Urine Microalbumin / Creatinine Ratio (ACR)",
        value: 44,
        unit: "mg/g",
        refLow: 0,
        refHigh: 30,
        flag: "H",
        confidence: 0.94,
        page: 1,
      },
      {
        canonicalName: "vitamin_d",
        nameAsPrinted: "25-OH Vitamin D (Total)",
        value: 16.4,
        unit: "ng/mL",
        refLow: 30,
        refHigh: 100,
        flag: "L",
        confidence: 0.96,
        page: 1,
      },
    ],
  },
  {
    id: "sample-prediabetes-bp",
    title: "Sample 2: Early Prediabetes & Elevated Blood Pressure",
    subtitle: "Clearly marked sample report — Annual Preventive Checkup (HbA1c 6.0%, FBS 112, BP 132/84)",
    badge: "SAMPLE REPORT",
    reportDate: "02/11/2026",
    labName: "Sample — Bharat Care Preventive Labs (Mumbai)",
    documentType: "blood",
    rawTests: [
      {
        canonicalName: "hba1c",
        nameAsPrinted: "HbA1c",
        value: 6.0,
        unit: "%",
        refLow: 4.0,
        refHigh: 5.6,
        flag: "H",
        confidence: 0.99,
        page: 1,
      },
      {
        canonicalName: "fasting_glucose",
        nameAsPrinted: "Fasting Plasma Glucose",
        value: 112,
        unit: "mg/dL",
        refLow: 70,
        refHigh: 99,
        flag: "H",
        confidence: 0.98,
        page: 1,
      },
      {
        canonicalName: "systolic_bp",
        nameAsPrinted: "Systolic BP",
        value: 132,
        unit: "mmHg",
        refLow: 90,
        refHigh: 119,
        flag: "H",
        confidence: 0.96,
        page: 1,
      },
      {
        canonicalName: "diastolic_bp",
        nameAsPrinted: "Diastolic BP",
        value: 84,
        unit: "mmHg",
        refLow: 60,
        refHigh: 79,
        flag: "H",
        confidence: 0.96,
        page: 1,
      },
      {
        canonicalName: "ldl_cholesterol",
        nameAsPrinted: "LDL Cholesterol",
        value: 118,
        unit: "mg/dL",
        refLow: 0,
        refHigh: 99,
        flag: "H",
        confidence: 0.95,
        page: 1,
      },
      {
        canonicalName: "creatinine",
        nameAsPrinted: "Serum Creatinine",
        value: 0.88,
        unit: "mg/dL",
        refLow: 0.6,
        refHigh: 1.2,
        flag: "N",
        confidence: 0.97,
        page: 1,
      },
    ],
  },
  {
    id: "sample-cancer-pathology",
    title: "Sample 3: Breast Core Biopsy & Immunohistochemistry (Pathology Explainer)",
    subtitle: "Clearly marked sample report — Explains Grade, ER/PR/HER2, and Ki-67 in calm plain language (No risk/prognosis numbers)",
    badge: "SAMPLE PATHOLOGY REPORT",
    reportDate: "28/10/2026",
    labName: "Sample — Tata Histopathology & Molecular Reference Lab",
    documentType: "pathology/biopsy",
    pathologyTerms: [
      {
        term: "Invasive Ductal Carcinoma (NST), Nottingham Grade 2",
        contextAsPrinted: "Histologic Type: Invasive carcinoma of no special type (ductal), Moderately differentiated (Tubule score 3, Nuclear pleomorphism 2, Mitotic count 1 = Total 6/9, Grade 2).",
      },
      {
        term: "Estrogen Receptor (ER) Positive (Allred Score 7/8)",
        contextAsPrinted: "Strong nuclear positivity in >80% of tumor cells.",
      },
      {
        term: "Progesterone Receptor (PR) Positive (Allred Score 6/8)",
        contextAsPrinted: "Moderate to strong nuclear staining in 60% of cells.",
      },
      {
        term: "HER2/neu Negative (Score 1+)",
        contextAsPrinted: "Faint incomplete membrane staining in >10% of cells.",
      },
      {
        term: "Lymphovascular Invasion (LVI): Not identified",
        contextAsPrinted: "No tumor emboli seen within vascular or lymphatic spaces in the sampled cores.",
      },
    ],
    rawTests: [
      {
        canonicalName: "er_status",
        nameAsPrinted: "Estrogen Receptor (ER) Allred Score",
        value: 7,
        unit: "score",
        refLow: 0,
        refHigh: 8,
        flag: "H",
        confidence: 0.97,
        page: 1,
      },
      {
        canonicalName: "pr_status",
        nameAsPrinted: "Progesterone Receptor (PR) Allred Score",
        value: 6,
        unit: "score",
        refLow: 0,
        refHigh: 8,
        flag: "H",
        confidence: 0.97,
        page: 1,
      },
      {
        canonicalName: "her2_status",
        nameAsPrinted: "HER2/neu IHC Score",
        value: 1,
        unit: "score",
        refLow: 0,
        refHigh: 1,
        flag: "N",
        confidence: 0.96,
        page: 1,
      },
      {
        canonicalName: "ki67_index",
        nameAsPrinted: "Ki-67 Labelling Index",
        value: 18,
        unit: "%",
        refLow: 0,
        refHigh: 20,
        flag: "N",
        confidence: 0.94,
        page: 1,
      },
    ],
  },
];
