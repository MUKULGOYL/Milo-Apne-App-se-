import { EFFECTS_CONFIG } from "../../config/effects";
import { NormalizedTestValue } from "../normalize";
import { getRiskBand } from "./risk";
import {
  HorizonRiskSet,
  OrganKey,
  OrganRiskScore,
  SimulatorInput,
  SimulatorOutput,
  TrajectoryPoint,
} from "./types";

/**
 * Generates 2, 5, and 10-year trajectories for:
 * - No change
 * - Current treatment adherence
 * - Improved lifestyle
 */
export function buildTrajectories(
  values: NormalizedTestValue[],
  base5YrHorizon: HorizonRiskSet,
  calculatedEgfrValue?: number
) {
  const byCanonical: Record<string, number> = {};
  for (const v of values) {
    byCanonical[v.canonicalName] = v.value;
  }

  const startHba1c = byCanonical["hba1c"] ?? 6.4;
  const startSbp = byCanonical["systolic_bp"] ?? 132;
  const startEgfr = byCanonical["egfr"] ?? calculatedEgfrValue ?? 86;
  const startRisk = Math.round(
    (base5YrHorizon.organs.eyes.index +
      base5YrHorizon.organs.kidneys.index +
      base5YrHorizon.organs.nerves.index +
      base5YrHorizon.organs.heart.index) /
      4
  );

  const years = [0, 2, 5, 10];
  const drift = EFFECTS_CONFIG.trajectories;

  const overallRiskIndex: TrajectoryPoint[] = years.map((yr) => ({
    yearOffset: yr,
    label: yr === 0 ? "Now" : `${yr} yrs`,
    noChange: Math.min(96, Math.max(5, Math.round(startRisk + drift.noChangeDriftPerYear.riskIndexDrift * yr))),
    currentAdherence: Math.min(
      96,
      Math.max(5, Math.round(startRisk + drift.adherenceDriftPerYear.riskIndexDrift * yr))
    ),
    improvedLifestyle: Math.min(
      96,
      Math.max(5, Math.round(startRisk + drift.lifestyleDriftPerYear.riskIndexDrift * yr))
    ),
  }));

  const hba1c: TrajectoryPoint[] = years.map((yr) => ({
    yearOffset: yr,
    label: yr === 0 ? "Now" : `${yr} yrs`,
    noChange: Math.round((startHba1c + drift.noChangeDriftPerYear.hba1c * yr) * 10) / 10,
    currentAdherence: Math.max(
      5.0,
      Math.round((startHba1c + drift.adherenceDriftPerYear.hba1c * yr) * 10) / 10
    ),
    improvedLifestyle: Math.max(
      4.9,
      Math.round((startHba1c + drift.lifestyleDriftPerYear.hba1c * yr) * 10) / 10
    ),
  }));

  const systolicBp: TrajectoryPoint[] = years.map((yr) => ({
    yearOffset: yr,
    label: yr === 0 ? "Now" : `${yr} yrs`,
    noChange: Math.round(startSbp + drift.noChangeDriftPerYear.systolic * yr),
    currentAdherence: Math.max(110, Math.round(startSbp + drift.adherenceDriftPerYear.systolic * yr)),
    improvedLifestyle: Math.max(108, Math.round(startSbp + drift.lifestyleDriftPerYear.systolic * yr)),
  }));

  const egfr: TrajectoryPoint[] = years.map((yr) => ({
    yearOffset: yr,
    label: yr === 0 ? "Now" : `${yr} yrs`,
    noChange: Math.max(15, Math.round(startEgfr + drift.noChangeDriftPerYear.egfr * yr)),
    currentAdherence: Math.max(20, Math.round(startEgfr + drift.adherenceDriftPerYear.egfr * yr)),
    improvedLifestyle: Math.max(25, Math.round(startEgfr + drift.lifestyleDriftPerYear.egfr * yr)),
  }));

  return {
    overallRiskIndex,
    hba1c,
    systolicBp,
    egfr,
    disclaimer: EFFECTS_CONFIG.disclaimer,
  };
}

/**
 * Interactive Before-and-After Simulator calculated deterministically from src/config/effects.ts.
 */
export function runLifestyleSimulator(
  values: NormalizedTestValue[],
  base5YrHorizon: HorizonRiskSet,
  sim: SimulatorInput
): SimulatorOutput {
  const byCanonical: Record<string, number> = {};
  for (const v of values) {
    byCanonical[v.canonicalName] = v.value;
  }

  const baseHba1c = byCanonical["hba1c"] ?? null;
  const baseSbp = byCanonical["systolic_bp"] ?? null;
  const baseDbp = byCanonical["diastolic_bp"] ?? null;
  const baseLdl = byCanonical["ldl_cholesterol"] ?? null;

  const weightPct = Math.max(0, Math.min(10, sim.weightLossPercent));
  const walkSteps = Math.max(0, Math.min(4.5, sim.walkingMinutesAfterMeals / 10));
  const saltSteps = sim.saltReduction;
  const sleepBonus = sim.sleepHours >= 7 && sim.sleepHours <= 8.5 ? 1 : 0;
  const tobaccoBonus = sim.tobaccoCessation ? 1 : 0;
  const medBonus = sim.medicineAdherence ? 1 : 0;

  const hba1cDelta =
    weightPct * EFFECTS_CONFIG.weightLossPerPercent.hba1cDelta +
    walkSteps * EFFECTS_CONFIG.walkingPer10Min.hba1cDelta +
    sleepBonus * EFFECTS_CONFIG.optimalSleepBonus.hba1cDelta +
    tobaccoBonus * EFFECTS_CONFIG.tobaccoCessationBonus.hba1cDelta +
    medBonus * EFFECTS_CONFIG.medicineAdherenceBonus.hba1cDelta;

  const sbpDelta =
    weightPct * EFFECTS_CONFIG.weightLossPerPercent.systolicDelta +
    walkSteps * EFFECTS_CONFIG.walkingPer10Min.systolicDelta +
    saltSteps * EFFECTS_CONFIG.saltReductionStep.systolicDelta +
    sleepBonus * EFFECTS_CONFIG.optimalSleepBonus.systolicDelta +
    tobaccoBonus * EFFECTS_CONFIG.tobaccoCessationBonus.systolicDelta +
    medBonus * EFFECTS_CONFIG.medicineAdherenceBonus.systolicDelta;

  const dbpDelta =
    weightPct * EFFECTS_CONFIG.weightLossPerPercent.diastolicDelta +
    walkSteps * EFFECTS_CONFIG.walkingPer10Min.diastolicDelta +
    saltSteps * EFFECTS_CONFIG.saltReductionStep.diastolicDelta +
    sleepBonus * EFFECTS_CONFIG.optimalSleepBonus.diastolicDelta +
    tobaccoBonus * EFFECTS_CONFIG.tobaccoCessationBonus.diastolicDelta +
    medBonus * EFFECTS_CONFIG.medicineAdherenceBonus.diastolicDelta;

  const ldlDelta =
    weightPct * EFFECTS_CONFIG.weightLossPerPercent.ldlDelta +
    walkSteps * EFFECTS_CONFIG.walkingPer10Min.ldlDelta +
    medBonus * EFFECTS_CONFIG.medicineAdherenceBonus.ldlDelta;

  const estimatedHbA1c =
    baseHba1c !== null ? Math.max(4.8, Math.round((baseHba1c + hba1cDelta) * 10) / 10) : null;
  const estimatedSystolicBp =
    baseSbp !== null ? Math.max(102, Math.round(baseSbp + sbpDelta)) : null;
  const estimatedDiastolicBp =
    baseDbp !== null ? Math.max(65, Math.round(baseDbp + dbpDelta)) : null;
  const estimatedLdl =
    baseLdl !== null ? Math.max(55, Math.round(baseLdl + ldlDelta)) : null;

  const organRisks5Year = {} as Record<OrganKey, OrganRiskScore>;
  (["eyes", "kidneys", "nerves", "heart"] as OrganKey[]).forEach((organ) => {
    const baseOrgan = base5YrHorizon.organs[organ];
    const organDelta =
      weightPct * EFFECTS_CONFIG.weightLossPerPercent.organRiskDelta[organ] +
      walkSteps * EFFECTS_CONFIG.walkingPer10Min.organRiskDelta[organ] +
      saltSteps * EFFECTS_CONFIG.saltReductionStep.organRiskDelta[organ] +
      sleepBonus * EFFECTS_CONFIG.optimalSleepBonus.organRiskDelta[organ] +
      tobaccoBonus * EFFECTS_CONFIG.tobaccoCessationBonus.organRiskDelta[organ] +
      medBonus * EFFECTS_CONFIG.medicineAdherenceBonus.organRiskDelta[organ];

    const newIndex = Math.max(4, Math.min(96, Math.round(baseOrgan.index + organDelta)));
    organRisks5Year[organ] = {
      ...baseOrgan,
      index: newIndex,
      lowRange: Math.max(2, newIndex - 7),
      highRange: Math.min(99, newIndex + 7),
      band: getRiskBand(newIndex),
    };
  });

  const deltaSummary: string[] = [];
  if (estimatedHbA1c !== null && baseHba1c !== null && estimatedHbA1c < baseHba1c) {
    deltaSummary.push(
      `HbA1c moves from ${baseHba1c.toFixed(1)}% to ~${estimatedHbA1c.toFixed(1)}% (${(estimatedHbA1c - baseHba1c).toFixed(1)}%)`
    );
  }
  if (estimatedSystolicBp !== null && baseSbp !== null && estimatedSystolicBp < baseSbp) {
    deltaSummary.push(
      `Systolic BP moves from ${baseSbp} to ~${estimatedSystolicBp} mmHg (${estimatedSystolicBp - baseSbp} mmHg)`
    );
  }
  if (estimatedLdl !== null && baseLdl !== null && estimatedLdl < baseLdl) {
    deltaSummary.push(
      `LDL moves from ${baseLdl} to ~${estimatedLdl} mg/dL (${estimatedLdl - baseLdl} mg/dL)`
    );
  }

  return {
    disclaimer: EFFECTS_CONFIG.disclaimer,
    estimatedHbA1c,
    estimatedSystolicBp,
    estimatedDiastolicBp,
    estimatedLdl,
    organRisks5Year,
    deltaSummary,
  };
}
