import { describe, expect, it } from "vitest";
import {
  CallAExtractResponseSchema,
  CallBVerifyResponseSchema,
  mergeAndNormalizeExtraction,
} from "../lib/extract";

describe("Extraction & Verification Zod Schemas and Merge Pipeline", () => {
  it("validates Call A and Call B schemas and marks disagreed values as needsCheck", () => {
    const callA = CallAExtractResponseSchema.parse({
      reportDate: "14/10/2026",
      labName: "Metro Diagnostics",
      documentType: "blood",
      tests: [
        {
          canonicalName: "hba1c",
          nameAsPrinted: "HbA1c",
          value: 7.2,
          unit: "%",
          refLow: 4.0,
          refHigh: 5.6,
          flag: "H",
          confidence: 0.94,
          page: 1,
        },
        {
          canonicalName: "creatinine",
          nameAsPrinted: "S. Creatinine",
          value: 1.9,
          unit: "mg/dL",
          refLow: 0.7,
          refHigh: 1.3,
          flag: "H",
          confidence: 0.89,
          page: 1,
        },
      ],
    });

    const callB = CallBVerifyResponseSchema.parse({
      discrepancies: [
        {
          nameAsPrinted: "S. Creatinine",
          callAValue: 1.9,
          verifiedValue: 1.09,
          verifiedUnit: "mg/dL",
          reason: "Printed decimal is 1.09 mg/dL, not 1.9 mg/dL",
          isImplausibleOrUncertain: true,
        },
      ],
    });

    const merged = mergeAndNormalizeExtraction([callA], [callB]);
    expect(merged.reportDate).toBe("2026-10-14");

    const creat = merged.normalizedValues.find((v) => v.canonicalName === "creatinine");
    expect(creat).toBeDefined();
    expect(creat?.value).toBe(1.09);
    expect(creat?.needsCheck).toBe(true);
    expect(creat?.confirmedByUser).toBe(false);

    const a1c = merged.normalizedValues.find((v) => v.canonicalName === "hba1c");
    expect(a1c?.needsCheck).toBe(false);
    expect(a1c?.confirmedByUser).toBe(true);
  });
});
