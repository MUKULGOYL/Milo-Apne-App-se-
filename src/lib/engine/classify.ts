import { THRESHOLDS } from "../../config/thresholds";
import { NormalizedTestValue } from "../normalize";
import { calculateCkdEpi2021, classifyEgfrStage } from "./ckdEpi";
import { ClassifiedFinding, EngineProfileContext, UrgentAlert } from "./types";

export function classifyReportValues(
  values: NormalizedTestValue[],
  profile: EngineProfileContext
): {
  findings: ClassifiedFinding[];
  urgentAlerts: UrgentAlert[];
  calculatedEgfr?: {
    value: number;
    stage: string;
    formula: string;
    note: string;
  };
} {
  const findings: ClassifiedFinding[] = [];
  const urgentAlerts: UrgentAlert[] = [];

  const byCanonical: Record<string, NormalizedTestValue> = {};
  for (const v of values) {
    byCanonical[v.canonicalName] = v;
  }

  // Handle BP pair together if both exist
  const sysVal = byCanonical["systolic_bp"];
  const diaVal = byCanonical["diastolic_bp"];

  for (const item of values) {
    const val = item.value;

    switch (item.canonicalName) {
      case "hba1c": {
        const t = THRESHOLDS.hba1c;
        let status: ClassifiedFinding["status"] = "normal";
        let categoryLabel = "Normal range (<5.7%)";
        let plainSummary =
          "Your 3-month average blood sugar is in the healthy normal range.";

        if (val >= t.urgentMin) {
          status = "urgent";
          categoryLabel = "Markedly elevated diabetes range (≥10.5%)";
          plainSummary =
            "Your 3-month average blood sugar is significantly high and needs prompt medical review.";
          urgentAlerts.push({
            testName: "HbA1c",
            value: `${val}%`,
            reason: "HbA1c at or above 10.5% indicates sustained high blood glucose requiring prompt doctor consultation.",
          });
        } else if (val >= t.diabetesMin) {
          status = "high";
          categoryLabel = "Diabetes range (≥6.5%)";
          plainSummary =
            val >= t.highRiskMin
              ? "Your 3-month average blood sugar is above target in the diabetes range."
              : "Your 3-month average blood sugar is in the diabetes range (6.5% or above).";
        } else if (val >= t.prediabetesMin) {
          status = "borderline";
          categoryLabel = "Prediabetes range (5.7%–6.4%)";
          plainSummary =
            "Your 3-month average blood sugar is slightly elevated in the prediabetes range—an early window where food, walking, and sleep changes work best.";
        }

        findings.push({
          canonicalName: item.canonicalName,
          displayName: item.displayName,
          value: val,
          unit: item.unit,
          status,
          categoryLabel,
          guidelineSource: t.source,
          plainSummary,
          clinicalReviewNote: item.clinicalReviewNote,
        });
        break;
      }

      case "fasting_glucose": {
        const t = THRESHOLDS.fastingGlucose;
        let status: ClassifiedFinding["status"] = "normal";
        let categoryLabel = "Normal fasting range (70–99 mg/dL)";
        let plainSummary = "Your morning fasting blood sugar is within the normal range.";

        if (val <= t.urgentLowMax) {
          status = "urgent";
          categoryLabel = "Urgent low blood sugar (<55 mg/dL)";
          plainSummary = "Fasting glucose is dangerously low (hypoglycaemia).";
          urgentAlerts.push({
            testName: "Fasting Blood Glucose",
            value: `${val} mg/dL`,
            reason: "Critically low blood glucose (<55 mg/dL) requires immediate care.",
          });
        } else if (val <= t.lowMax) {
          status = "low";
          categoryLabel = "Low fasting glucose (55–69 mg/dL)";
          plainSummary = "Your fasting blood sugar is below 70 mg/dL. Discuss with your doctor, especially if taking sugar-lowering medicines.";
        } else if (val >= t.urgentHighMin) {
          status = "urgent";
          categoryLabel = "Urgent high fasting glucose (≥300 mg/dL)";
          plainSummary = "Your fasting blood sugar is very high and requires prompt clinical evaluation.";
          urgentAlerts.push({
            testName: "Fasting Blood Glucose",
            value: `${val} mg/dL`,
            reason: "Very high fasting glucose (≥300 mg/dL) requires prompt medical attention.",
          });
        } else if (val >= t.diabetesMin) {
          status = "high";
          categoryLabel = "Diabetes range (≥126 mg/dL)";
          plainSummary = "Your morning fasting glucose is in the diabetes range (126 mg/dL or above).";
        } else if (val >= t.prediabetesMin) {
          status = "borderline";
          categoryLabel = "Prediabetes / Impaired fasting glucose (100–125 mg/dL)";
          plainSummary = "Your morning fasting sugar is slightly above normal (100–125 mg/dL).";
        }

        findings.push({
          canonicalName: item.canonicalName,
          displayName: item.displayName,
          value: val,
          unit: item.unit,
          status,
          categoryLabel,
          guidelineSource: t.source,
          plainSummary,
          clinicalReviewNote: item.clinicalReviewNote,
        });
        break;
      }

      case "pp_glucose":
      case "random_glucose": {
        const t = THRESHOLDS.postPrandialGlucose;
        let status: ClassifiedFinding["status"] = "normal";
        let categoryLabel = "Normal post-meal range (<140 mg/dL)";
        let plainSummary = "Your blood sugar after eating is within the expected range.";

        if (val <= t.urgentLowMax) {
          status = "urgent";
          categoryLabel = "Urgent low glucose (<55 mg/dL)";
          plainSummary = "Blood glucose is dangerously low.";
          urgentAlerts.push({
            testName: item.displayName,
            value: `${val} mg/dL`,
            reason: "Critically low blood sugar (<55 mg/dL).",
          });
        } else if (val >= t.urgentHighMin) {
          status = "urgent";
          categoryLabel = "Urgent high glucose (≥350 mg/dL)";
          plainSummary = "Blood sugar is markedly elevated and needs medical review today.";
          urgentAlerts.push({
            testName: item.displayName,
            value: `${val} mg/dL`,
            reason: "Markedly elevated glucose (≥350 mg/dL) needs prompt medical attention.",
          });
        } else if (val >= t.diabetesMin) {
          status = "high";
          categoryLabel = "Diabetes range (≥200 mg/dL)";
          plainSummary = "Your post-meal blood sugar is 200 mg/dL or above.";
        } else if (val >= t.prediabetesMin) {
          status = "borderline";
          categoryLabel = "Prediabetes / Impaired glucose tolerance (140–199 mg/dL)";
          plainSummary = "Your post-meal sugar is moderately elevated (140–199 mg/dL). A 15-minute walk after meals helps lower this spike.";
        }

        findings.push({
          canonicalName: item.canonicalName,
          displayName: item.displayName,
          value: val,
          unit: item.unit,
          status,
          categoryLabel,
          guidelineSource: t.source,
          plainSummary,
          clinicalReviewNote: item.clinicalReviewNote,
        });
        break;
      }

      case "systolic_bp": {
        const t = THRESHOLDS.bloodPressure;
        const dia = diaVal ? diaVal.value : 75;
        let status: ClassifiedFinding["status"] = "normal";
        let categoryLabel = "Normal blood pressure (<120/<80 mmHg)";
        let plainSummary = "Your blood pressure is in the healthy normal range.";

        if (val >= t.urgent.systolicMin || dia >= t.urgent.diastolicMin) {
          status = "urgent";
          categoryLabel = "Hypertensive urgency range (≥180 and/or ≥120 mmHg)";
          plainSummary = "Blood pressure is in the urgent range. Please contact a doctor or urgent care today.";
          urgentAlerts.push({
            testName: "Blood Pressure",
            value: `${val}/${dia} mmHg`,
            reason: "Blood pressure at or above 180/120 mmHg requires same-day medical evaluation.",
          });
        } else if (val >= t.stage2.systolicMin || dia >= t.stage2.diastolicMin) {
          status = "high";
          categoryLabel = "Stage 2 High Blood Pressure (≥140 or ≥90 mmHg)";
          plainSummary = "Blood pressure is in the Stage 2 range and puts extra pressure on heart, eye, and kidney vessels.";
        } else if (
          (val >= t.stage1.systolicMin && val <= t.stage1.systolicMax) ||
          (dia >= t.stage1.diastolicMin && dia <= t.stage1.diastolicMax)
        ) {
          status = "elevated";
          categoryLabel = "Stage 1 High Blood Pressure (130–139 or 80–89 mmHg)";
          plainSummary = "Blood pressure is mildly elevated (Stage 1). Reducing salt, walking daily, and better sleep can help bring it down.";
        } else if (val >= t.elevated.systolicMin && val <= t.elevated.systolicMax && dia <= t.elevated.diastolicMax) {
          status = "borderline";
          categoryLabel = "Elevated Blood Pressure (120–129 and <80 mmHg)";
          plainSummary = "Systolic pressure is slightly above 120 mmHg.";
        }

        findings.push({
          canonicalName: item.canonicalName,
          displayName: item.displayName,
          value: val,
          unit: item.unit,
          status,
          categoryLabel,
          guidelineSource: t.source,
          plainSummary,
          clinicalReviewNote: item.clinicalReviewNote,
        });
        break;
      }

      case "diastolic_bp": {
        const t = THRESHOLDS.bloodPressure;
        let status: ClassifiedFinding["status"] = "normal";
        let categoryLabel = "Normal diastolic (<80 mmHg)";
        if (val >= t.urgent.diastolicMin) {
          status = "urgent";
          categoryLabel = "Urgent diastolic (≥120 mmHg)";
        } else if (val >= t.stage2.diastolicMin) {
          status = "high";
          categoryLabel = "Stage 2 diastolic (≥90 mmHg)";
        } else if (val >= t.stage1.diastolicMin) {
          status = "elevated";
          categoryLabel = "Stage 1 diastolic (80–89 mmHg)";
        }
        findings.push({
          canonicalName: item.canonicalName,
          displayName: item.displayName,
          value: val,
          unit: item.unit,
          status,
          categoryLabel,
          guidelineSource: t.source,
          plainSummary: "Resting pressure in the arteries between heartbeats.",
          clinicalReviewNote: item.clinicalReviewNote,
        });
        break;
      }

      case "egfr": {
        const t = THRESHOLDS.egfr;
        const { stageCode, stageLabel } = classifyEgfrStage(val);
        let status: ClassifiedFinding["status"] = "normal";
        if (val <= t.urgentMax) {
          status = "urgent";
          urgentAlerts.push({
            testName: "eGFR (Kidney Filtration)",
            value: `${val} mL/min/1.73m²`,
            reason: "Markedly decreased kidney filtration (<30 mL/min/1.73m²) needs prompt clinical attention.",
          });
        } else if (stageCode === "G3a" || stageCode === "G3b") {
          status = "high";
        } else if (stageCode === "G2") {
          status = "borderline";
        }
        findings.push({
          canonicalName: item.canonicalName,
          displayName: item.displayName,
          value: val,
          unit: item.unit,
          status,
          categoryLabel: stageLabel,
          guidelineSource: t.source,
          plainSummary: `Kidney filtration rate is in category ${stageCode}.`,
          clinicalReviewNote: item.clinicalReviewNote,
        });
        break;
      }

      case "urine_acr": {
        const t = THRESHOLDS.urineAcr;
        let status: ClassifiedFinding["status"] = "normal";
        let categoryLabel: string = t.categories.A1.label;
        let plainSummary = "Minimal protein leakage in urine—a reassuring sign for kidney filter health.";
        if (val > t.categories.A2.max) {
          status = "high";
          categoryLabel = t.categories.A3.label;
          plainSummary = "Severely increased protein in urine (>300 mg/g). Controlling blood pressure and blood sugar closely protects the kidneys.";
        } else if (val >= t.categories.A2.min) {
          status = "elevated";
          categoryLabel = t.categories.A2.label;
          plainSummary = "Moderately increased albumin in urine (30–300 mg/g), an early sign of kidney filter strain.";
        }
        findings.push({
          canonicalName: item.canonicalName,
          displayName: item.displayName,
          value: val,
          unit: item.unit,
          status,
          categoryLabel,
          guidelineSource: t.source,
          plainSummary,
          clinicalReviewNote: item.clinicalReviewNote,
        });
        break;
      }

      case "ldl_cholesterol": {
        const t = THRESHOLDS.lipids;
        let status: ClassifiedFinding["status"] = "normal";
        let categoryLabel = "Optimal LDL (<100 mg/dL)";
        if (val >= t.ldl.highMin) {
          status = "high";
          categoryLabel = val >= t.ldl.veryHighMin ? "Very high LDL (≥190 mg/dL)" : "High LDL (160–189 mg/dL)";
        } else if (val > t.ldl.nearOptimalMax) {
          status = "elevated";
          categoryLabel = "Borderline high LDL (130–159 mg/dL)";
        } else if (val > t.ldl.optimalMax) {
          status = "borderline";
          categoryLabel = "Near optimal LDL (100–129 mg/dL)";
        }
        findings.push({
          canonicalName: item.canonicalName,
          displayName: item.displayName,
          value: val,
          unit: item.unit,
          status,
          categoryLabel,
          guidelineSource: t.source,
          plainSummary: "LDL carries cholesterol that can slowly build up inside heart and brain arteries.",
          clinicalReviewNote: item.clinicalReviewNote,
        });
        break;
      }

      case "hdl_cholesterol": {
        const t = THRESHOLDS.lipids;
        const lowCut = profile.sex === "female" ? t.hdl.lowFemale : t.hdl.lowMale;
        const status: ClassifiedFinding["status"] = val < lowCut ? "borderline" : "normal";
        const categoryLabel =
          val >= t.hdl.optimalMin
            ? "Protective HDL (≥60 mg/dL)"
            : val < lowCut
              ? `Low HDL (<${lowCut} mg/dL)`
              : "Acceptable HDL";
        findings.push({
          canonicalName: item.canonicalName,
          displayName: item.displayName,
          value: val,
          unit: item.unit,
          status,
          categoryLabel,
          guidelineSource: t.source,
          plainSummary: "HDL helps clear excess cholesterol from blood vessels. Brisk walking and nuts help support HDL.",
          clinicalReviewNote: item.clinicalReviewNote,
        });
        break;
      }

      case "triglycerides": {
        const t = THRESHOLDS.lipids;
        let status: ClassifiedFinding["status"] = "normal";
        let categoryLabel = "Normal triglycerides (<150 mg/dL)";
        if (val >= t.triglycerides.veryHighMin) {
          status = "high";
          categoryLabel = "Very high triglycerides (≥500 mg/dL)";
        } else if (val > t.triglycerides.borderlineMax) {
          status = "high";
          categoryLabel = "High triglycerides (200–499 mg/dL)";
        } else if (val > t.triglycerides.normalMax) {
          status = "borderline";
          categoryLabel = "Borderline high triglycerides (150–199 mg/dL)";
        }
        findings.push({
          canonicalName: item.canonicalName,
          displayName: item.displayName,
          value: val,
          unit: item.unit,
          status,
          categoryLabel,
          guidelineSource: t.source,
          plainSummary: "Triglycerides are blood fats strongly linked to refined carbohydrates, sugars, and excess calories.",
          clinicalReviewNote: item.clinicalReviewNote,
        });
        break;
      }

      case "total_cholesterol": {
        const t = THRESHOLDS.lipids;
        const status: ClassifiedFinding["status"] =
          val >= t.totalCholesterol.highMin
            ? "high"
            : val > t.totalCholesterol.desirableMax
              ? "borderline"
              : "normal";
        const categoryLabel =
          val >= t.totalCholesterol.highMin
            ? "High total cholesterol (≥240 mg/dL)"
            : val > t.totalCholesterol.desirableMax
              ? "Borderline total cholesterol (200–239 mg/dL)"
              : "Desirable total cholesterol (<200 mg/dL)";
        findings.push({
          canonicalName: item.canonicalName,
          displayName: item.displayName,
          value: val,
          unit: item.unit,
          status,
          categoryLabel,
          guidelineSource: t.source,
          plainSummary: "Combined measure of LDL, HDL, and VLDL cholesterol in the blood.",
          clinicalReviewNote: item.clinicalReviewNote,
        });
        break;
      }

      case "creatinine": {
        const maxNorm =
          profile.sex === "female"
            ? THRESHOLDS.otherTests.creatinine.femaleNormalMax
            : THRESHOLDS.otherTests.creatinine.maleNormalMax;
        const status: ClassifiedFinding["status"] =
          val > maxNorm * 2.2 ? "urgent" : val > maxNorm ? "elevated" : "normal";
        if (status === "urgent") {
          urgentAlerts.push({
            testName: "Serum Creatinine",
            value: `${val} mg/dL`,
            reason: "Significantly elevated serum creatinine requires prompt medical evaluation.",
          });
        }
        findings.push({
          canonicalName: item.canonicalName,
          displayName: item.displayName,
          value: val,
          unit: item.unit,
          status,
          categoryLabel: val > maxNorm ? `Above typical range (>${maxNorm} mg/dL)` : `Within typical range (≤${maxNorm} mg/dL)`,
          guidelineSource: THRESHOLDS.egfr.source,
          plainSummary: "Creatinine is a natural muscle breakdown waste product filtered out by your kidneys.",
          clinicalReviewNote: item.clinicalReviewNote,
        });
        break;
      }

      default: {
        let status: ClassifiedFinding["status"] = "normal";
        let categoryLabel = "Within reference range";
        if (item.refLow !== null && val < item.refLow) {
          status = "low";
          categoryLabel = `Below reference range (<${item.refLow} ${item.unit})`;
        } else if (item.refHigh !== null && val > item.refHigh) {
          status = "elevated";
          categoryLabel = `Above reference range (>${item.refHigh} ${item.unit})`;
        }
        findings.push({
          canonicalName: item.canonicalName,
          displayName: item.displayName,
          value: val,
          unit: item.unit,
          status,
          categoryLabel,
          guidelineSource: "Printed lab reference interval",
          plainSummary: `Measured value is ${val} ${item.unit}.`,
          clinicalReviewNote: item.clinicalReviewNote || "Needs clinical review alongside full lab context.",
        });
      }
    }
  }

  // If eGFR is missing and creatinine is available, calculate eGFR with CKD-EPI 2021
  let calculatedEgfr:
    | {
        value: number;
        stage: string;
        formula: string;
        note: string;
      }
    | undefined;

  if (!byCanonical["egfr"] && byCanonical["creatinine"]) {
    const creat = byCanonical["creatinine"].value;
    const calc = calculateCkdEpi2021(creat, profile.age || 45, profile.sex || "male");
    calculatedEgfr = {
      value: calc.egfr,
      stage: calc.stageLabel,
      formula: "CKD-EPI 2021 (Race-Free Creatinine Equation)",
      note: "Calculated from Serum Creatinine, Age, and Sex (not printed on report; needs clinical review).",
    };

    const isUrgent = calc.egfr <= THRESHOLDS.egfr.urgentMax;
    if (isUrgent) {
      urgentAlerts.push({
        testName: "Calculated eGFR",
        value: `${calc.egfr} mL/min/1.73m²`,
        reason: "Calculated kidney filtration is below 30 mL/min/1.73m² and warrants prompt clinical review.",
      });
    }

    findings.push({
      canonicalName: "egfr",
      displayName: "eGFR (Calculated)",
      value: calc.egfr,
      unit: "mL/min/1.73m²",
      status: isUrgent ? "urgent" : calc.egfr < 60 ? "high" : calc.egfr < 90 ? "borderline" : "normal",
      categoryLabel: `${calc.stageLabel} (Calculated)`,
      guidelineSource: THRESHOLDS.egfr.source,
      plainSummary: `Estimated kidney filtration rate calculated from your creatinine (${creat} mg/dL), age (${profile.age}), and sex.`,
      isCalculated: true,
      clinicalReviewNote: "Calculated via CKD-EPI 2021 equation; confirm with your doctor.",
    });
  }

  return { findings, urgentAlerts, calculatedEgfr };
}
