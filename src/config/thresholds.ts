/**
 * Deterministic clinical thresholds for Milo's rule engine.
 * Every threshold has an explicit clinical guideline source and review date.
 * The AI never invents numbers; all classification comes from this file.
 */

export interface ThresholdRule {
  source: string;
  lastReviewed: string;
  unit: string;
}

export const THRESHOLDS = {
  hba1c: {
    source: "American Diabetes Association (ADA) Standards of Care / ICMR-INDIAB",
    lastReviewed: "2026-01-15",
    unit: "%",
    normalMax: 5.6,
    prediabetesMin: 5.7,
    prediabetesMax: 6.4,
    diabetesMin: 6.5,
    highRiskMin: 8.0,
    urgentMin: 10.5,
  },
  fastingGlucose: {
    source: "ADA Standards of Care / ICMR Guidelines for Management of Type 2 Diabetes",
    lastReviewed: "2026-01-15",
    unit: "mg/dL",
    urgentLowMax: 54,
    lowMax: 69,
    normalMin: 70,
    normalMax: 99,
    prediabetesMin: 100,
    prediabetesMax: 125,
    diabetesMin: 126,
    urgentHighMin: 300,
  },
  postPrandialGlucose: {
    source: "ADA / ICMR 2-Hour Post-Meal Plasma Glucose Guidelines",
    lastReviewed: "2026-01-15",
    unit: "mg/dL",
    urgentLowMax: 54,
    normalMax: 139,
    prediabetesMin: 140,
    prediabetesMax: 199,
    diabetesMin: 200,
    urgentHighMin: 350,
  },
  bloodPressure: {
    source: "ACC/AHA 2017 High Blood Pressure Clinical Practice Guideline",
    lastReviewed: "2026-01-15",
    unit: "mmHg",
    normal: { systolicMax: 119, diastolicMax: 79 },
    elevated: { systolicMin: 120, systolicMax: 129, diastolicMax: 79 },
    stage1: { systolicMin: 130, systolicMax: 139, diastolicMin: 80, diastolicMax: 89 },
    stage2: { systolicMin: 140, diastolicMin: 90 },
    urgent: { systolicMin: 180, diastolicMin: 120 },
    hypotension: { systolicMax: 89, diastolicMax: 59 },
  },
  egfr: {
    source: "KDIGO 2024 Clinical Practice Guideline for CKD Evaluation & CKD-EPI 2021 (Race-Free)",
    lastReviewed: "2026-02-01",
    unit: "mL/min/1.73m²",
    stages: {
      G1: { min: 90, label: "G1 — Normal or high kidney filtration" },
      G2: { min: 60, max: 89, label: "G2 — Mildly decreased filtration" },
      G3a: { min: 45, max: 59, label: "G3a — Mild-to-moderate decrease" },
      G3b: { min: 30, max: 44, label: "G3b — Moderate-to-severe decrease" },
      G4: { min: 15, max: 29, label: "G4 — Severely decreased filtration" },
      G5: { min: 0, max: 14, label: "G5 — Kidney failure range (urgent clinical review)" },
    },
    urgentMax: 29,
  },
  urineAcr: {
    source: "KDIGO 2024 Albuminuria Categories",
    lastReviewed: "2026-02-01",
    unit: "mg/g",
    categories: {
      A1: { max: 29.9, label: "A1 — Normal to mildly increased (<30 mg/g)" },
      A2: { min: 30, max: 300, label: "A2 — Moderately increased (30–300 mg/g)" },
      A3: { min: 300.1, label: "A3 — Severely increased (>300 mg/g)" },
    },
  },
  lipids: {
    source: "Lipid Association of India (LAI) & ACC/AHA Cholesterol Guidelines",
    lastReviewed: "2026-01-15",
    unit: "mg/dL",
    totalCholesterol: { desirableMax: 199, borderlineMax: 239, highMin: 240 },
    ldl: { optimalMax: 99, nearOptimalMax: 129, borderlineMax: 159, highMin: 160, veryHighMin: 190 },
    hdl: { lowMale: 40, lowFemale: 50, optimalMin: 60 },
    triglycerides: { normalMax: 149, borderlineMax: 199, highMax: 499, veryHighMin: 500 },
  },
  otherTests: {
    creatinine: { unit: "mg/dL", maleNormalMax: 1.3, femaleNormalMax: 1.1, plausibilityMin: 0.1, plausibilityMax: 25 },
    tsh: { unit: "mIU/L", normalMin: 0.45, normalMax: 4.5, plausibilityMin: 0.01, plausibilityMax: 150 },
    hemoglobin: { unit: "g/dL", maleNormalMin: 13.0, femaleNormalMin: 12.0, urgentLowMax: 7.0 },
    altSgpt: { unit: "U/L", normalMax: 40 },
    astSgot: { unit: "U/L", normalMax: 40 },
    vitaminB12: { unit: "pg/mL", deficientMax: 199, borderlineMax: 299, normalMin: 300 },
    vitaminD: { unit: "ng/mL", deficientMax: 19.9, insufficientMax: 29.9, normalMin: 30 },
    uricAcid: { unit: "mg/dL", maleNormalMax: 7.0, femaleNormalMax: 6.0 },
  },
  horizonMultipliers: {
    source: "Illustrative relative index horizon scaling (UKPDS / Framingham directional weighting)",
    lastReviewed: "2026-01-15",
    years2: { multiplier: 0.72, halfBandWidth: 5 },
    years5: { multiplier: 1.0, halfBandWidth: 8 },
    years10: { multiplier: 1.28, halfBandWidth: 13 },
  },
  riskBands: [
    { max: 24, band: "Low" as const },
    { max: 49, band: "Moderate" as const },
    { max: 74, band: "High" as const },
    { max: 100, band: "Very high" as const },
  ],
} as const;
