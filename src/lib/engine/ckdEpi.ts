import { THRESHOLDS } from "../../config/thresholds";

/**
 * Race-free CKD-EPI 2021 Creatinine Equation (Inker LA et al., NEJM 2021)
 * eGFR = 142 * min(Scr/kappa, 1)^alpha * max(Scr/kappa, 1)^(-1.200) * 0.9938^Age * (1.012 if female)
 *
 * Where:
 * - Female: kappa = 0.7, alpha = -0.241, sexMultiplier = 1.012
 * - Male:   kappa = 0.9, alpha = -0.302, sexMultiplier = 1.0
 */
export function calculateCkdEpi2021(
  serumCreatinineMgDl: number,
  ageYears: number,
  sex: "male" | "female"
): {
  egfr: number;
  stageCode: "G1" | "G2" | "G3a" | "G3b" | "G4" | "G5";
  stageLabel: string;
} {
  const scr = Math.max(0.1, serumCreatinineMgDl);
  const age = Math.max(18, Math.min(110, ageYears));

  const kappa = sex === "female" ? 0.7 : 0.9;
  const alpha = sex === "female" ? -0.241 : -0.302;
  const sexMultiplier = sex === "female" ? 1.012 : 1.0;

  const ratio = scr / kappa;
  const minPart = Math.pow(Math.min(ratio, 1), alpha);
  const maxPart = Math.pow(Math.max(ratio, 1), -1.2);
  const agePart = Math.pow(0.9938, age);

  const rawEgfr = 142 * minPart * maxPart * agePart * sexMultiplier;
  const egfr = Math.round(rawEgfr * 10) / 10;

  const { stageCode, stageLabel } = classifyEgfrStage(egfr);
  return { egfr, stageCode, stageLabel };
}

export function classifyEgfrStage(egfr: number): {
  stageCode: "G1" | "G2" | "G3a" | "G3b" | "G4" | "G5";
  stageLabel: string;
} {
  const stages = THRESHOLDS.egfr.stages;
  if (egfr >= stages.G1.min) return { stageCode: "G1", stageLabel: stages.G1.label };
  if (egfr >= stages.G2.min) return { stageCode: "G2", stageLabel: stages.G2.label };
  if (egfr >= stages.G3a.min) return { stageCode: "G3a", stageLabel: stages.G3a.label };
  if (egfr >= stages.G3b.min) return { stageCode: "G3b", stageLabel: stages.G3b.label };
  if (egfr >= stages.G4.min) return { stageCode: "G4", stageLabel: stages.G4.label };
  return { stageCode: "G5", stageLabel: stages.G5.label };
}
