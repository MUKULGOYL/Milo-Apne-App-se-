import { describe, expect, it } from "vitest";
import {
  convertToStandardUnit,
  normalizeExtractedTests,
  normalizeIndianDate,
  resolveCanonicalName,
} from "../lib/normalize";

describe("Normalization & Indian Lab Synonym Pipeline", () => {
  it("maps common Indian lab printed names to canonical test names", () => {
    expect(resolveCanonicalName("Glycosylated Hemoglobin (HbA1c)")).toBe("hba1c");
    expect(resolveCanonicalName("Blood Sugar Fasting (FBS)")).toBe("fasting_glucose");
    expect(resolveCanonicalName("Glucose - 2 Hr Post Prandial (PPBS)")).toBe("pp_glucose");
    expect(resolveCanonicalName("S. Creatinine")).toBe("creatinine");
    expect(resolveCanonicalName("Urine Microalbumin / ACR")).toBe("urine_acr");
    expect(resolveCanonicalName("SGPT (ALT)")).toBe("sgpt_alt");
  });

  it("converts mmol/L glucose and mmol/mol HbA1c to mg/dL and %", () => {
    const gluc = convertToStandardUnit("fasting_glucose", 7.0, "mmol/L");
    expect(gluc.converted).toBe(true);
    expect(gluc.unit).toBe("mg/dL");
    expect(gluc.value).toBeCloseTo(126.1, 1);

    const a1c = convertToStandardUnit("hba1c", 48, "mmol/mol");
    expect(a1c.converted).toBe(true);
    expect(a1c.unit).toBe("%");
    expect(a1c.value).toBeCloseTo(6.5, 1);
  });

  it("normalizes DD/MM/YYYY Indian dates to YYYY-MM-DD", () => {
    expect(normalizeIndianDate("15/10/2026")).toBe("2026-10-15");
    expect(normalizeIndianDate("5-3-2026")).toBe("2026-03-05");
  });

  it("deduplicates across pages keeping the highest confidence and flags implausible values", () => {
    const out = normalizeExtractedTests([
      {
        nameAsPrinted: "FBS",
        value: 118,
        unit: "mg/dL",
        confidence: 0.72,
        page: 1,
      },
      {
        nameAsPrinted: "Blood Sugar Fasting",
        value: 118,
        unit: "mg/dL",
        confidence: 0.96,
        page: 2,
      },
      {
        nameAsPrinted: "HbA1c",
        value: 45, // Implausible %
        unit: "%",
        confidence: 0.95,
        page: 1,
      },
    ]);

    expect(out.length).toBe(2);
    const fbs = out.find((x) => x.canonicalName === "fasting_glucose");
    expect(fbs?.confidence).toBe(0.96);
    expect(fbs?.needsCheck).toBe(false);

    const a1c = out.find((x) => x.canonicalName === "hba1c");
    expect(a1c?.needsCheck).toBe(true);
    expect(a1c?.plausibilityWarning).toBeDefined();
  });
});
