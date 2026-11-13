/**
 * Deterministic normalization, synonym mapping, unit conversion, deduplication,
 * and plausibility validation for Indian laboratory reports.
 */

export type CanonicalTestName =
  | "hba1c"
  | "fasting_glucose"
  | "pp_glucose"
  | "random_glucose"
  | "systolic_bp"
  | "diastolic_bp"
  | "pulse"
  | "total_cholesterol"
  | "hdl_cholesterol"
  | "ldl_cholesterol"
  | "vldl_cholesterol"
  | "triglycerides"
  | "creatinine"
  | "blood_urea"
  | "uric_acid"
  | "egfr"
  | "urine_acr"
  | "tsh"
  | "hemoglobin"
  | "sgpt_alt"
  | "sgot_ast"
  | "vitamin_b12"
  | "vitamin_d"
  | "psa"
  | "ca_125"
  | "cea"
  | "afp"
  | "ca_19_9"
  | "er_status"
  | "pr_status"
  | "her2_status"
  | "ki67_index"
  | "other";

export interface RawExtractedTest {
  canonicalName?: string;
  nameAsPrinted: string;
  value: number;
  unit: string;
  refLow?: number | null;
  refHigh?: number | null;
  flag?: "L" | "N" | "H" | "CRITICAL" | string;
  confidence: number; // 0 to 1
  page: number;
  needsCheck?: boolean;
  verifyNote?: string;
}

export interface NormalizedTestValue {
  id: string;
  canonicalName: CanonicalTestName;
  displayName: string;
  nameAsPrinted: string;
  value: number;
  unit: string;
  originalValue?: number;
  originalUnit?: string;
  refLow: number | null;
  refHigh: number | null;
  confidence: number;
  page: number;
  needsCheck: boolean;
  confirmedByUser: boolean;
  plausibilityWarning?: string;
  clinicalReviewNote?: string;
}

interface CanonicalMeta {
  canonical: CanonicalTestName;
  displayName: string;
  standardUnit: string;
  defaultRefLow: number | null;
  defaultRefHigh: number | null;
  plausibleMin: number;
  plausibleMax: number;
  synonyms: string[];
}

export const CANONICAL_TESTS: Record<Exclude<CanonicalTestName, "other">, CanonicalMeta> = {
  hba1c: {
    canonical: "hba1c",
    displayName: "HbA1c (Glycosylated Hemoglobin)",
    standardUnit: "%",
    defaultRefLow: 4.0,
    defaultRefHigh: 5.6,
    plausibleMin: 3.0,
    plausibleMax: 22.0,
    synonyms: [
      "hba1c",
      "hb a1c",
      "a1c",
      "glycosylated hemoglobin",
      "glycosylated haemoglobin",
      "glycated hemoglobin",
      "glycated haemoglobin",
      "hba1c hplc",
    ],
  },
  fasting_glucose: {
    canonical: "fasting_glucose",
    displayName: "Fasting Blood Sugar (FBS)",
    standardUnit: "mg/dL",
    defaultRefLow: 70,
    defaultRefHigh: 99,
    plausibleMin: 25,
    plausibleMax: 800,
    synonyms: [
      "fasting glucose",
      "fasting blood sugar",
      "blood sugar fasting",
      "fbs",
      "glucose fasting",
      "plasma glucose fasting",
      "glucose - fasting",
      "fpg",
      "fasting plasma glucose",
    ],
  },
  pp_glucose: {
    canonical: "pp_glucose",
    displayName: "Post-Prandial Blood Sugar (PPBS)",
    standardUnit: "mg/dL",
    defaultRefLow: 70,
    defaultRefHigh: 139,
    plausibleMin: 30,
    plausibleMax: 900,
    synonyms: [
      "pp_glucose",
      "pp glucose",
      "ppbs",
      "post prandial",
      "post-prandial",
      "blood sugar pp",
      "glucose pp",
      "plasma glucose post prandial",
      "2 hr post meal glucose",
      "post meal blood sugar",
      "ppbg",
    ],
  },
  random_glucose: {
    canonical: "random_glucose",
    displayName: "Random Blood Sugar (RBS)",
    standardUnit: "mg/dL",
    defaultRefLow: 70,
    defaultRefHigh: 140,
    plausibleMin: 25,
    plausibleMax: 900,
    synonyms: ["rbs", "random blood sugar", "random glucose", "glucose random", "blood sugar random"],
  },
  systolic_bp: {
    canonical: "systolic_bp",
    displayName: "Systolic Blood Pressure",
    standardUnit: "mmHg",
    defaultRefLow: 90,
    defaultRefHigh: 119,
    plausibleMin: 50,
    plausibleMax: 280,
    synonyms: ["systolic", "systolic bp", "sbp", "systolic blood pressure", "bp systolic", "sys"],
  },
  diastolic_bp: {
    canonical: "diastolic_bp",
    displayName: "Diastolic Blood Pressure",
    standardUnit: "mmHg",
    defaultRefLow: 60,
    defaultRefHigh: 79,
    plausibleMin: 30,
    plausibleMax: 180,
    synonyms: ["diastolic", "diastolic bp", "dbp", "diastolic blood pressure", "bp diastolic", "dia"],
  },
  pulse: {
    canonical: "pulse",
    displayName: "Pulse / Heart Rate",
    standardUnit: "bpm",
    defaultRefLow: 60,
    defaultRefHigh: 100,
    plausibleMin: 30,
    plausibleMax: 240,
    synonyms: ["pulse", "heart rate", "hr", "pulse rate"],
  },
  total_cholesterol: {
    canonical: "total_cholesterol",
    displayName: "Total Cholesterol",
    standardUnit: "mg/dL",
    defaultRefLow: 125,
    defaultRefHigh: 199,
    plausibleMin: 50,
    plausibleMax: 600,
    synonyms: ["total cholesterol", "cholesterol total", "serum cholesterol", "tc", "cholesterol"],
  },
  hdl_cholesterol: {
    canonical: "hdl_cholesterol",
    displayName: "HDL Cholesterol",
    standardUnit: "mg/dL",
    defaultRefLow: 40,
    defaultRefHigh: 60,
    plausibleMin: 10,
    plausibleMax: 150,
    synonyms: ["hdl", "hdl cholesterol", "hdl-c", "high density lipoprotein", "cholesterol hdl", "hdl direct"],
  },
  ldl_cholesterol: {
    canonical: "ldl_cholesterol",
    displayName: "LDL Cholesterol",
    standardUnit: "mg/dL",
    defaultRefLow: 0,
    defaultRefHigh: 99,
    plausibleMin: 15,
    plausibleMax: 450,
    synonyms: [
      "ldl",
      "ldl cholesterol",
      "ldl-c",
      "low density lipoprotein",
      "ldl direct",
      "ldl calculated",
      "cholesterol ldl",
    ],
  },
  vldl_cholesterol: {
    canonical: "vldl_cholesterol",
    displayName: "VLDL Cholesterol",
    standardUnit: "mg/dL",
    defaultRefLow: 5,
    defaultRefHigh: 30,
    plausibleMin: 2,
    plausibleMax: 200,
    synonyms: ["vldl", "vldl cholesterol", "vldl-c", "very low density lipoprotein"],
  },
  triglycerides: {
    canonical: "triglycerides",
    displayName: "Triglycerides",
    standardUnit: "mg/dL",
    defaultRefLow: 0,
    defaultRefHigh: 149,
    plausibleMin: 20,
    plausibleMax: 2500,
    synonyms: ["triglycerides", "triglyceride", "tg", "tgl", "serum triglycerides"],
  },
  creatinine: {
    canonical: "creatinine",
    displayName: "Serum Creatinine",
    standardUnit: "mg/dL",
    defaultRefLow: 0.6,
    defaultRefHigh: 1.2,
    plausibleMin: 0.1,
    plausibleMax: 25.0,
    synonyms: ["s. creatinine", "serum creatinine", "creatinine", "s creatinine", "creatinine serum", "creat"],
  },
  blood_urea: {
    canonical: "blood_urea",
    displayName: "Blood Urea",
    standardUnit: "mg/dL",
    defaultRefLow: 15,
    defaultRefHigh: 40,
    plausibleMin: 5,
    plausibleMax: 300,
    synonyms: ["blood urea", "urea", "serum urea", "b. urea"],
  },
  uric_acid: {
    canonical: "uric_acid",
    displayName: "Serum Uric Acid",
    standardUnit: "mg/dL",
    defaultRefLow: 3.5,
    defaultRefHigh: 7.0,
    plausibleMin: 1.0,
    plausibleMax: 20.0,
    synonyms: ["uric acid", "s. uric acid", "serum uric acid"],
  },
  egfr: {
    canonical: "egfr",
    displayName: "eGFR (Kidney Filtration)",
    standardUnit: "mL/min/1.73m²",
    defaultRefLow: 90,
    defaultRefHigh: 120,
    plausibleMin: 2,
    plausibleMax: 180,
    synonyms: ["egfr", "estimated gfr", "gfr", "e-gfr", "ckd-epi egfr"],
  },
  urine_acr: {
    canonical: "urine_acr",
    displayName: "Urine Albumin-to-Creatinine Ratio (ACR)",
    standardUnit: "mg/g",
    defaultRefLow: 0,
    defaultRefHigh: 29.9,
    plausibleMin: 0,
    plausibleMax: 5000,
    synonyms: [
      "urine acr",
      "acr",
      "albumin creatinine ratio",
      "microalbumin",
      "urine microalbumin",
      "urine albumin",
      "uacr",
      "microalbuminuria",
    ],
  },
  tsh: {
    canonical: "tsh",
    displayName: "TSH (Thyroid Stimulating Hormone)",
    standardUnit: "mIU/L",
    defaultRefLow: 0.45,
    defaultRefHigh: 4.5,
    plausibleMin: 0.005,
    plausibleMax: 150,
    synonyms: ["tsh", "thyroid stimulating hormone", "s. tsh", "serum tsh", "ultra sensitive tsh", "ustsh"],
  },
  hemoglobin: {
    canonical: "hemoglobin",
    displayName: "Hemoglobin (Hb)",
    standardUnit: "g/dL",
    defaultRefLow: 12.0,
    defaultRefHigh: 17.0,
    plausibleMin: 3.0,
    plausibleMax: 22.0,
    synonyms: ["hemoglobin", "haemoglobin", "hb", "hb%", "complete blood count hb"],
  },
  sgpt_alt: {
    canonical: "sgpt_alt",
    displayName: "SGPT / ALT (Liver Enzyme)",
    standardUnit: "U/L",
    defaultRefLow: 7,
    defaultRefHigh: 40,
    plausibleMin: 2,
    plausibleMax: 3000,
    synonyms: ["sgpt", "alt", "sgpt (alt)", "alt (sgpt)", "alanine aminotransferase", "alanine transaminase"],
  },
  sgot_ast: {
    canonical: "sgot_ast",
    displayName: "SGOT / AST (Liver Enzyme)",
    standardUnit: "U/L",
    defaultRefLow: 8,
    defaultRefHigh: 40,
    plausibleMin: 2,
    plausibleMax: 3000,
    synonyms: ["sgot", "ast", "sgot (ast)", "ast (sgot)", "aspartate aminotransferase", "aspartate transaminase"],
  },
  vitamin_b12: {
    canonical: "vitamin_b12",
    displayName: "Vitamin B12",
    standardUnit: "pg/mL",
    defaultRefLow: 300,
    defaultRefHigh: 900,
    plausibleMin: 30,
    plausibleMax: 3000,
    synonyms: ["vitamin b12", "vit b12", "cobalamin", "cyanocobalamin", "serum b12"],
  },
  vitamin_d: {
    canonical: "vitamin_d",
    displayName: "Vitamin D (25-OH)",
    standardUnit: "ng/mL",
    defaultRefLow: 30,
    defaultRefHigh: 100,
    plausibleMin: 2,
    plausibleMax: 200,
    synonyms: ["vitamin d", "25-oh vitamin d", "vit d", "25 hydroxy vitamin d", "cholecalciferol", "vitamin d3"],
  },
  psa: {
    canonical: "psa",
    displayName: "Total PSA (Prostate Specific Antigen)",
    standardUnit: "ng/mL",
    defaultRefLow: 0,
    defaultRefHigh: 4.0,
    plausibleMin: 0,
    plausibleMax: 1000,
    synonyms: ["psa", "total psa", "prostate specific antigen", "s. psa"],
  },
  ca_125: {
    canonical: "ca_125",
    displayName: "CA-125 Marker",
    standardUnit: "U/mL",
    defaultRefLow: 0,
    defaultRefHigh: 35,
    plausibleMin: 0,
    plausibleMax: 5000,
    synonyms: ["ca 125", "ca-125", "cancer antigen 125"],
  },
  cea: {
    canonical: "cea",
    displayName: "CEA (Carcinoembryonic Antigen)",
    standardUnit: "ng/mL",
    defaultRefLow: 0,
    defaultRefHigh: 3.0,
    plausibleMin: 0,
    plausibleMax: 2000,
    synonyms: ["cea", "carcinoembryonic antigen"],
  },
  afp: {
    canonical: "afp",
    displayName: "AFP (Alpha-Fetoprotein)",
    standardUnit: "ng/mL",
    defaultRefLow: 0,
    defaultRefHigh: 10,
    plausibleMin: 0,
    plausibleMax: 10000,
    synonyms: ["afp", "alpha fetoprotein", "alpha-fetoprotein"],
  },
  ca_19_9: {
    canonical: "ca_19_9",
    displayName: "CA 19-9 Marker",
    standardUnit: "U/mL",
    defaultRefLow: 0,
    defaultRefHigh: 37,
    plausibleMin: 0,
    plausibleMax: 10000,
    synonyms: ["ca 19-9", "ca 19.9", "ca19-9", "carbohydrate antigen 19-9"],
  },
  er_status: {
    canonical: "er_status",
    displayName: "Estrogen Receptor (ER) Allred Score",
    standardUnit: "score",
    defaultRefLow: 0,
    defaultRefHigh: 8,
    plausibleMin: 0,
    plausibleMax: 8,
    synonyms: ["er", "estrogen receptor", "er status", "er score"],
  },
  pr_status: {
    canonical: "pr_status",
    displayName: "Progesterone Receptor (PR) Allred Score",
    standardUnit: "score",
    defaultRefLow: 0,
    defaultRefHigh: 8,
    plausibleMin: 0,
    plausibleMax: 8,
    synonyms: ["pr", "progesterone receptor", "pr status", "pr score"],
  },
  her2_status: {
    canonical: "her2_status",
    displayName: "HER2/neu Score",
    standardUnit: "score",
    defaultRefLow: 0,
    defaultRefHigh: 3,
    plausibleMin: 0,
    plausibleMax: 3,
    synonyms: ["her2", "her2/neu", "her-2", "c-erbb-2"],
  },
  ki67_index: {
    canonical: "ki67_index",
    displayName: "Ki-67 Proliferation Index",
    standardUnit: "%",
    defaultRefLow: 0,
    defaultRefHigh: 20,
    plausibleMin: 0,
    plausibleMax: 100,
    synonyms: ["ki-67", "ki67", "ki 67", "mib-1", "ki-67 index"],
  },
};

/**
 * Resolves any printed Indian lab test name or AI canonical string to our strict CanonicalTestName.
 */
export function resolveCanonicalName(printedOrSuggested: string): CanonicalTestName {
  const cleaned = printedOrSuggested
    .toLowerCase()
    .replace(/[()[\].,/:-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned in CANONICAL_TESTS) {
    return cleaned as CanonicalTestName;
  }

  for (const [key, meta] of Object.entries(CANONICAL_TESTS)) {
    for (const syn of meta.synonyms) {
      if (cleaned === syn || cleaned.includes(syn)) {
        return key as CanonicalTestName;
      }
    }
  }

  return "other";
}

/**
 * Converts international units (mmol/L, mmol/mol, umol/L) to standard Indian clinical units (mg/dL, %).
 */
export function convertToStandardUnit(
  canonicalName: CanonicalTestName,
  value: number,
  unit: string
): { value: number; unit: string; converted: boolean } {
  const cleanUnit = unit.trim().toLowerCase();

  // Glucose: mmol/L -> mg/dL (multiply by 18.0182)
  if (
    (canonicalName === "fasting_glucose" ||
      canonicalName === "pp_glucose" ||
      canonicalName === "random_glucose") &&
    cleanUnit.includes("mmol")
  ) {
    return {
      value: Math.round(value * 18.0182 * 10) / 10,
      unit: "mg/dL",
      converted: true,
    };
  }

  // HbA1c: IFCC mmol/mol -> NGSP %: (0.09148 * mmol/mol) + 2.152
  if (canonicalName === "hba1c" && cleanUnit.includes("mmol")) {
    const pct = 0.09148 * value + 2.152;
    return {
      value: Math.round(pct * 10) / 10,
      unit: "%",
      converted: true,
    };
  }

  // Cholesterol (Total, HDL, LDL): mmol/L -> mg/dL (multiply by 38.67)
  if (
    (canonicalName === "total_cholesterol" ||
      canonicalName === "hdl_cholesterol" ||
      canonicalName === "ldl_cholesterol") &&
    cleanUnit.includes("mmol")
  ) {
    return {
      value: Math.round(value * 38.67),
      unit: "mg/dL",
      converted: true,
    };
  }

  // Triglycerides: mmol/L -> mg/dL (multiply by 88.57)
  if (canonicalName === "triglycerides" && cleanUnit.includes("mmol")) {
    return {
      value: Math.round(value * 88.57),
      unit: "mg/dL",
      converted: true,
    };
  }

  // Creatinine: umol/L (µmol/L) -> mg/dL (divide by 88.4)
  if (
    canonicalName === "creatinine" &&
    (cleanUnit.includes("umol") || cleanUnit.includes("µmol") || cleanUnit.includes("mcmol"))
  ) {
    return {
      value: Math.round((value / 88.4) * 100) / 100,
      unit: "mg/dL",
      converted: true,
    };
  }

  const meta = canonicalName !== "other" ? CANONICAL_TESTS[canonicalName] : undefined;
  return {
    value: Math.round(value * 100) / 100,
    unit: meta ? meta.standardUnit : unit || "units",
    converted: false,
  };
}

/**
 * Parses Indian date strings (DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, or ISO YYYY-MM-DD)
 * into ISO YYYY-MM-DD format.
 */
export function normalizeIndianDate(dateStr?: string | null): string {
  if (!dateStr) {
    return new Date().toISOString().slice(0, 10);
  }
  const trimmed = dateStr.trim();
  // Match DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, "0");
    const month = dmyMatch[2].padStart(2, "0");
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }
  // Match YYYY-MM-DD
  const ymdMatch = trimmed.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, "0");
    const day = ymdMatch[3].padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

/**
 * Code step C: Normalize extracted values:
 * - Maps synonyms to canonical names
 * - Converts units to standard clinical units
 * - Drops duplicates across pages (keeping highest confidence)
 * - Validates against physiological plausibility ranges
 */
export function normalizeExtractedTests(rawTests: RawExtractedTest[]): NormalizedTestValue[] {
  const bestByCanonical: Record<string, NormalizedTestValue> = {};

  rawTests.forEach((raw, idx) => {
    const canonicalFromRaw = raw.canonicalName ? resolveCanonicalName(raw.canonicalName) : "other";
    const canonicalFromPrinted = resolveCanonicalName(raw.nameAsPrinted);
    const canonicalName =
      canonicalFromRaw !== "other" ? canonicalFromRaw : canonicalFromPrinted;

    const meta = canonicalName !== "other" ? CANONICAL_TESTS[canonicalName] : undefined;
    const conv = convertToStandardUnit(canonicalName, Number(raw.value), raw.unit || "");

    let plausibilityWarning: string | undefined;
    if (meta) {
      if (conv.value < meta.plausibleMin || conv.value > meta.plausibleMax) {
        plausibilityWarning = `Value ${conv.value} ${conv.unit} is outside typical physiological limits (${meta.plausibleMin}–${meta.plausibleMax} ${meta.standardUnit}). Please double-check against your printed report.`;
      }
    }

    const needsCheck =
      Boolean(raw.needsCheck) ||
      raw.confidence < 0.82 ||
      Boolean(plausibilityWarning);

    const normalizedItem: NormalizedTestValue = {
      id: `test-${idx}-${Date.now()}`,
      canonicalName,
      displayName: meta ? meta.displayName : raw.nameAsPrinted,
      nameAsPrinted: raw.nameAsPrinted,
      value: conv.value,
      unit: conv.unit,
      originalValue: conv.converted ? raw.value : undefined,
      originalUnit: conv.converted ? raw.unit : undefined,
      refLow: raw.refLow !== undefined && raw.refLow !== null ? raw.refLow : meta ? meta.defaultRefLow : null,
      refHigh: raw.refHigh !== undefined && raw.refHigh !== null ? raw.refHigh : meta ? meta.defaultRefHigh : null,
      confidence: Math.max(0, Math.min(1, Number(raw.confidence) || 0.85)),
      page: raw.page || 1,
      needsCheck,
      confirmedByUser: !needsCheck,
      plausibilityWarning,
      clinicalReviewNote: raw.verifyNote,
    };

    const dedupeKey =
      canonicalName !== "other"
        ? canonicalName
        : `other_${raw.nameAsPrinted.toLowerCase().trim()}`;

    const existing = bestByCanonical[dedupeKey];
    if (!existing || normalizedItem.confidence > existing.confidence) {
      bestByCanonical[dedupeKey] = normalizedItem;
    }
  });

  return Object.values(bestByCanonical);
}
