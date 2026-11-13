import { CanonicalTestName, NormalizedTestValue } from "../normalize";

export type RiskBand = "Low" | "Moderate" | "High" | "Very high";

export type OrganKey = "eyes" | "kidneys" | "nerves" | "heart";

export interface ClassifiedFinding {
  canonicalName: CanonicalTestName;
  displayName: string;
  value: number;
  unit: string;
  status: "normal" | "borderline" | "elevated" | "high" | "low" | "urgent" | "info";
  categoryLabel: string;
  guidelineSource: string;
  plainSummary: string;
  isCalculated?: boolean;
  clinicalReviewNote?: string;
}

export interface OrganRiskScore {
  organ: OrganKey;
  label: string;
  index: number; // 0 to 100
  lowRange: number;
  highRange: number;
  band: RiskBand;
  topDrivers: string[];
  protectiveFactors: string[];
}

export interface HorizonRiskSet {
  horizonYears: 2 | 5 | 10;
  organs: Record<OrganKey, OrganRiskScore>;
}

export interface TrajectoryPoint {
  yearOffset: number; // 0, 2, 5, 10
  label: string;
  noChange: number;
  currentAdherence: number;
  improvedLifestyle: number;
}

export interface SimulatorInput {
  weightLossPercent: number; // 0 to 10%
  walkingMinutesAfterMeals: number; // 0 to 45 mins
  saltReduction: 0 | 1 | 2; // 0 = none, 1 = moderate, 2 = strict
  sleepHours: number; // 5 to 9
  tobaccoCessation: boolean;
  medicineAdherence: boolean;
}

export interface SimulatorOutput {
  disclaimer: string;
  estimatedHbA1c: number | null;
  estimatedSystolicBp: number | null;
  estimatedDiastolicBp: number | null;
  estimatedLdl: number | null;
  organRisks5Year: Record<OrganKey, OrganRiskScore>;
  deltaSummary: string[];
}

export interface UrgentAlert {
  testName: string;
  value: string;
  reason: string;
}

export interface DeterministicEngineOutput {
  engineVersion: string;
  calculatedAt: string;
  isCancerReport: boolean;
  hasUrgentValues: boolean;
  urgentBannerMessage?: string;
  urgentAlerts: UrgentAlert[];
  findings: ClassifiedFinding[];
  calculatedEgfr?: {
    value: number;
    stage: string;
    formula: string;
    note: string;
  };
  horizons: {
    years2: HorizonRiskSet;
    years5: HorizonRiskSet;
    years10: HorizonRiskSet;
  } | null;
  trajectories: {
    overallRiskIndex: TrajectoryPoint[];
    hba1c: TrajectoryPoint[];
    systolicBp: TrajectoryPoint[];
    egfr: TrajectoryPoint[];
    disclaimer: string;
  } | null;
  assumptionsUsed: string[];
}

export interface EngineProfileContext {
  age: number;
  sex: "male" | "female";
  heightCm?: number;
  weightKg?: number;
  waistCm?: number;
  conditions?: string[];
  tobaccoUse?: boolean;
  diabetesDurationYears?: number;
  activityMinutesPerDay?: number;
}
