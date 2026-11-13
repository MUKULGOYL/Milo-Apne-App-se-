import { describe, expect, it } from "vitest";
import {
  calculateCkdEpi2021,
  detectDailyLogUpwardTrends,
  detectReportUpwardTrends,
  runDeterministicEngine,
  runLifestyleSimulator,
} from "../lib/engine";
import { normalizeExtractedTests } from "../lib/normalize";
import { Reading, Report } from "../lib/storage";

describe("Deterministic Clinical Engine", () => {
  it("calculates race-free CKD-EPI 2021 eGFR accurately and labels it calculated when missing", () => {
    const ckd = calculateCkdEpi2021(1.2, 55, "male");
    expect(ckd.egfr).toBeGreaterThan(60);
    expect(ckd.egfr).toBeLessThan(80);
    expect(ckd.stageCode).toBe("G2");

    const normalized = normalizeExtractedTests([
      {
        canonicalName: "creatinine",
        nameAsPrinted: "S. Creatinine",
        value: 1.2,
        unit: "mg/dL",
        confidence: 0.96,
        page: 1,
      },
    ]);

    const output = runDeterministicEngine(normalized, {
      age: 55,
      sex: "male",
    });

    expect(output.calculatedEgfr).toBeDefined();
    expect(output.calculatedEgfr?.value).toBe(ckd.egfr);
    const egfrFinding = output.findings.find((f) => f.canonicalName === "egfr");
    expect(egfrFinding?.isCalculated).toBe(true);
    expect(egfrFinding?.displayName).toContain("Calculated");
  });

  it("classifies ADA HbA1c and ACC/AHA 2017 BP stages and triggers urgent safety banner at >=180/120", () => {
    const values = normalizeExtractedTests([
      {
        nameAsPrinted: "HbA1c",
        value: 6.1,
        unit: "%",
        confidence: 0.99,
        page: 1,
      },
      {
        nameAsPrinted: "Systolic BP",
        value: 184,
        unit: "mmHg",
        confidence: 0.99,
        page: 1,
      },
      {
        nameAsPrinted: "Diastolic BP",
        value: 122,
        unit: "mmHg",
        confidence: 0.99,
        page: 1,
      },
    ]);

    const res = runDeterministicEngine(values, { age: 50, sex: "female" });
    expect(res.hasUrgentValues).toBe(true);
    expect(res.urgentBannerMessage).toBe("Please contact a doctor or urgent care today.");

    const a1c = res.findings.find((f) => f.canonicalName === "hba1c");
    expect(a1c?.status).toBe("borderline");
    expect(a1c?.categoryLabel).toContain("Prediabetes");
  });

  it("widens uncertainty ranges across 2, 5, and 10 year horizons and computes simulator improvements", () => {
    const values = normalizeExtractedTests([
      { nameAsPrinted: "HbA1c", value: 7.8, unit: "%", confidence: 0.98, page: 1 },
      { nameAsPrinted: "Systolic BP", value: 144, unit: "mmHg", confidence: 0.98, page: 1 },
      { nameAsPrinted: "LDL Cholesterol", value: 145, unit: "mg/dL", confidence: 0.98, page: 1 },
    ]);

    const engineOut = runDeterministicEngine(values, { age: 52, sex: "male" });
    expect(engineOut.horizons).not.toBeNull();
    const h2 = engineOut.horizons!.years2.organs.heart;
    const h5 = engineOut.horizons!.years5.organs.heart;
    const h10 = engineOut.horizons!.years10.organs.heart;

    expect(h10.highRange - h10.lowRange).toBeGreaterThan(h5.highRange - h5.lowRange);
    expect(h5.highRange - h5.lowRange).toBeGreaterThan(h2.highRange - h2.lowRange);

    const simOut = runLifestyleSimulator(values, engineOut.horizons!.years5, {
      weightLossPercent: 5,
      walkingMinutesAfterMeals: 30,
      saltReduction: 2,
      sleepHours: 7.5,
      tobaccoCessation: true,
      medicineAdherence: true,
    });

    expect(simOut.estimatedHbA1c).toBeLessThan(7.8);
    expect(simOut.estimatedSystolicBp).toBeLessThan(144);
    expect(simOut.organRisks5Year.heart.index).toBeLessThan(h5.index);
  });

  it("strictly omits risk scores and trajectories for cancer / pathology reports", () => {
    const values = normalizeExtractedTests([
      { nameAsPrinted: "Ki-67 Index", value: 15, unit: "%", confidence: 0.95, page: 1 },
    ]);

    const out = runDeterministicEngine(values, { age: 48, sex: "female" }, "pathology/biopsy");
    expect(out.isCancerReport).toBe(true);
    expect(out.horizons).toBeNull();
    expect(out.trajectories).toBeNull();
  });

  it("detects 3 consecutive upward entries for HbA1c and Systolic BP across reports and daily logs", () => {
    const makeReport = (id: string, date: string, hba1c: number, sbp: number): Report => {
      const vals = normalizeExtractedTests([
        { nameAsPrinted: "HbA1c", value: hba1c, unit: "%", confidence: 0.99, page: 1 },
        { nameAsPrinted: "Systolic BP", value: sbp, unit: "mmHg", confidence: 0.99, page: 1 },
      ]);
      return {
        id,
        profileId: "p1",
        date,
        labName: "Test Lab",
        type: "blood",
        values: vals,
        engineOutput: runDeterministicEngine(vals, { age: 50, sex: "male" }),
        narrative: null,
        createdAt: `${date}T09:00:00Z`,
      };
    };

    const reports = [
      makeReport("r1", "2026-01-10", 6.8, 128),
      makeReport("r2", "2026-05-10", 7.2, 134),
      makeReport("r3", "2026-09-10", 7.7, 142),
    ];

    const reportAlerts = detectReportUpwardTrends(reports);
    expect(reportAlerts.some((a) => a.metricKey === "hba1c")).toBe(true);
    expect(reportAlerts.some((a) => a.metricKey === "systolic_bp")).toBe(true);

    const logReadings: Reading[] = [
      {
        id: "l1",
        profileId: "p1",
        kind: "bp",
        value: 126,
        secondaryValue: 80,
        context: "morning",
        time: "2026-10-01T08:00:00Z",
      },
      {
        id: "l2",
        profileId: "p1",
        kind: "bp",
        value: 132,
        secondaryValue: 84,
        context: "morning",
        time: "2026-10-02T08:00:00Z",
      },
      {
        id: "l3",
        profileId: "p1",
        kind: "bp",
        value: 139,
        secondaryValue: 88,
        context: "morning",
        time: "2026-10-03T08:00:00Z",
      },
    ];

    const logAlerts = detectDailyLogUpwardTrends(logReadings);
    expect(logAlerts.some((a) => a.metricKey === "systolic_bp")).toBe(true);
    expect(logAlerts.some((a) => a.metricKey === "diastolic_bp")).toBe(true);
  });
});

