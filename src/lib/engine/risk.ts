import { THRESHOLDS } from "../../config/thresholds";
import { NormalizedTestValue } from "../normalize";
import { EngineProfileContext, HorizonRiskSet, OrganKey, OrganRiskScore, RiskBand } from "./types";

export function getRiskBand(index: number): RiskBand {
  for (const b of THRESHOLDS.riskBands) {
    if (index <= b.max) return b.band;
  }
  return "Very high";
}

function clampIndex(val: number): number {
  return Math.max(4, Math.min(96, Math.round(val)));
}

/**
 * Computes the Relative Risk Index (0 to 100) per organ (eyes, kidneys, nerves, heart & vessels)
 * with Low-High uncertainty ranges across 2, 5, and 10 year horizons.
 * Explicitly structured so published clinical risk equations can be dropped in.
 */
export function computeOrganRiskHorizons(
  values: NormalizedTestValue[],
  profile: EngineProfileContext,
  calculatedEgfrValue?: number
): {
  horizons: {
    years2: HorizonRiskSet;
    years5: HorizonRiskSet;
    years10: HorizonRiskSet;
  };
  assumptionsUsed: string[];
} {
  const byCanonical: Record<string, number> = {};
  for (const v of values) {
    byCanonical[v.canonicalName] = v.value;
  }

  const assumptionsUsed: string[] = [];

  // Extract or assume baseline drivers
  const hba1c =
    byCanonical["hba1c"] ??
    (byCanonical["fasting_glucose"]
      ? (byCanonical["fasting_glucose"] + 46.7) / 28.7
      : 5.5);
  if (byCanonical["hba1c"] === undefined) {
    assumptionsUsed.push(
      byCanonical["fasting_glucose"]
        ? "Estimated HbA1c directional contribution from Fasting Blood Sugar."
        : "Assumed non-diabetic baseline HbA1c (5.5%) as no sugar marker was provided."
    );
  }

  const sbp = byCanonical["systolic_bp"] ?? 122;
  if (byCanonical["systolic_bp"] === undefined) {
    assumptionsUsed.push("Assumed baseline systolic BP of 122 mmHg (no BP reading in report).");
  }

  const ldl = byCanonical["ldl_cholesterol"] ?? 105;
  if (byCanonical["ldl_cholesterol"] === undefined) {
    assumptionsUsed.push("Assumed baseline LDL cholesterol of 105 mg/dL.");
  }

  const tg = byCanonical["triglycerides"] ?? 135;
  const egfr = byCanonical["egfr"] ?? calculatedEgfrValue ?? 92;
  const acr = byCanonical["urine_acr"] ?? 12;

  const age = profile.age || 45;
  const durationPenalty = (profile.diabetesDurationYears ?? 0) * 1.4;
  const tobaccoPenalty = profile.tobaccoUse ? 12 : 0;

  // Waist / BMI contribution
  let anthropometryPenalty = 0;
  if (profile.waistCm) {
    const highCut = profile.sex === "female" ? 80 : 90;
    if (profile.waistCm >= highCut + 10) anthropometryPenalty = 7;
    else if (profile.waistCm >= highCut) anthropometryPenalty = 4;
  }

  // Glycaemic driver (0 to 45 points)
  const glycaemicLoad = Math.max(0, (hba1c - 5.4) * 10.5);

  // BP driver (0 to 35 points)
  const bpLoad = Math.max(0, (sbp - 115) * 0.55);

  // Lipid driver (0 to 25 points)
  const lipidLoad = Math.max(0, (ldl - 90) * 0.18 + Math.max(0, tg - 150) * 0.03);

  // Kidney marker driver (0 to 35 points)
  const egfrLoad = egfr < 90 ? (90 - egfr) * 0.45 : 0;
  const acrLoad = acr >= 300 ? 22 : acr >= 30 ? 11 : 0;
  const kidneyMarkerLoad = egfrLoad + acrLoad;

  // Age baseline (small gentle contribution)
  const ageLoad = Math.max(0, (age - 35) * 0.25);

  // 5-year Base Relative Indices per Organ
  const base5Yr: Record<OrganKey, number> = {
    eyes: clampIndex(
      10 + glycaemicLoad * 1.15 + bpLoad * 0.55 + durationPenalty + tobaccoPenalty * 0.5
    ),
    kidneys: clampIndex(
      10 + glycaemicLoad * 0.9 + bpLoad * 0.85 + kidneyMarkerLoad * 1.1 + durationPenalty + tobaccoPenalty * 0.6
    ),
    nerves: clampIndex(
      10 + glycaemicLoad * 1.2 + anthropometryPenalty + durationPenalty + tobaccoPenalty * 0.6 + ageLoad
    ),
    heart: clampIndex(
      12 +
        glycaemicLoad * 0.75 +
        bpLoad * 0.95 +
        lipidLoad * 1.15 +
        anthropometryPenalty +
        tobaccoPenalty +
        ageLoad
    ),
  };

  const buildDrivers = (organ: OrganKey): { drivers: string[]; protective: string[] } => {
    const drivers: string[] = [];
    const protective: string[] = [];

    if (hba1c >= 6.5) drivers.push(`Elevated HbA1c (${hba1c.toFixed(1)}%)`);
    else if (hba1c >= 5.7) drivers.push(`Borderline HbA1c (${hba1c.toFixed(1)}%)`);
    else protective.push("Healthy blood sugar control");

    if (sbp >= 130) drivers.push(`Elevated systolic blood pressure (${sbp} mmHg)`);
    else protective.push("Blood pressure below 130 mmHg");

    if (organ === "heart" && ldl >= 130) drivers.push(`Elevated LDL cholesterol (${ldl} mg/dL)`);
    if (organ === "heart" && ldl < 100) protective.push("Optimal LDL cholesterol (<100 mg/dL)");

    if (organ === "kidneys" && (egfr < 60 || acr >= 30)) {
      drivers.push(`Kidney filtration / albumin strain (eGFR ${egfr.toFixed(0)})`);
    } else if (organ === "kidneys") {
      protective.push("Preserved kidney filtration (eGFR)");
    }

    if (profile.tobaccoUse) drivers.push("Active tobacco use");
    else protective.push("Tobacco-free");

    if ((profile.activityMinutesPerDay ?? 0) >= 30) {
      protective.push("Regular daily walking/activity");
    }

    if (drivers.length === 0) {
      drivers.push("Age and routine metabolic baseline");
    }

    return { drivers, protective };
  };

  const organLabels: Record<OrganKey, string> = {
    eyes: "Eyes (Retina micro-vessels)",
    kidneys: "Kidneys (Filtration units)",
    nerves: "Nerves (Feet & peripheral nerves)",
    heart: "Heart & Blood Vessels",
  };

  const buildHorizonSet = (
    horizonYears: 2 | 5 | 10,
    multiplier: number,
    halfBandWidth: number
  ): HorizonRiskSet => {
    const organs = {} as Record<OrganKey, OrganRiskScore>;
    (["eyes", "kidneys", "nerves", "heart"] as OrganKey[]).forEach((organ) => {
      const scaled = clampIndex(base5Yr[organ] * multiplier);
      const lowRange = Math.max(2, scaled - halfBandWidth);
      const highRange = Math.min(99, scaled + halfBandWidth);
      const { drivers, protective } = buildDrivers(organ);

      organs[organ] = {
        organ,
        label: organLabels[organ],
        index: scaled,
        lowRange,
        highRange,
        band: getRiskBand(scaled),
        topDrivers: drivers,
        protectiveFactors: protective,
      };
    });
    return { horizonYears, organs };
  };

  const hm = THRESHOLDS.horizonMultipliers;
  assumptionsUsed.push(
    `Relative Risk Index (0–100) uses directional weighting (${hm.source}) and widens uncertainty bands at 2yr (±${hm.years2.halfBandWidth}), 5yr (±${hm.years5.halfBandWidth}), and 10yr (±${hm.years10.halfBandWidth}).`
  );

  return {
    horizons: {
      years2: buildHorizonSet(2, hm.years2.multiplier, hm.years2.halfBandWidth),
      years5: buildHorizonSet(5, hm.years5.multiplier, hm.years5.halfBandWidth),
      years10: buildHorizonSet(10, hm.years10.multiplier, hm.years10.halfBandWidth),
    },
    assumptionsUsed,
  };
}
