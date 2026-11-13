/**
 * Deterministic lifestyle and adherence effect sizes for Milo's simulator and trajectory engine.
 * Every scenario produced from these parameters is explicitly flagged:
 * "illustrative, needs clinical review".
 */

export interface EffectParameter {
  id: string;
  label: string;
  source: string;
  lastReviewed: string;
  disclaimer: string;
}

export const EFFECTS_CONFIG = {
  disclaimer: "Illustrative estimate, not a prediction for you. Needs clinical review.",
  lastReviewed: "2026-01-20",
  source: "Composite directional estimates from Look AHEAD, DASH-Sodium, DPP, and ICMR lifestyle trials",

  /**
   * Per 1% body weight reduction (up to 10%)
   */
  weightLossPerPercent: {
    hba1cDelta: -0.08, // % points per 1% weight loss
    systolicDelta: -0.9, // mmHg per 1% weight loss
    diastolicDelta: -0.5,
    ldlDelta: -1.4, // mg/dL
    triglyceridesDelta: -4.5,
    organRiskDelta: {
      eyes: -1.1,
      kidneys: -1.2,
      nerves: -1.0,
      heart: -1.6,
    },
  },

  /**
   * Post-meal brisk walking (per 10 minutes/day after meals, up to 45 mins)
   */
  walkingPer10Min: {
    hba1cDelta: -0.12,
    systolicDelta: -1.4,
    diastolicDelta: -0.8,
    ldlDelta: -1.8,
    organRiskDelta: {
      eyes: -1.4,
      kidneys: -1.3,
      nerves: -1.6,
      heart: -2.2,
    },
  },

  /**
   * Salt reduction (none = 0, moderate = 1, strict <5g/day = 2)
   */
  saltReductionStep: {
    hba1cDelta: 0,
    systolicDelta: -4.2, // per step (DASH-Sodium directional)
    diastolicDelta: -2.1,
    organRiskDelta: {
      eyes: -0.8,
      kidneys: -2.8,
      nerves: -0.4,
      heart: -3.2,
    },
  },

  /**
   * Restorative sleep (moving from <6h to 7–8h/night)
   */
  optimalSleepBonus: {
    hba1cDelta: -0.15,
    systolicDelta: -2.5,
    diastolicDelta: -1.5,
    organRiskDelta: {
      eyes: -1.0,
      kidneys: -1.0,
      nerves: -1.2,
      heart: -2.0,
    },
  },

  /**
   * Stopping tobacco (if currently using smoked or smokeless tobacco)
   */
  tobaccoCessationBonus: {
    hba1cDelta: -0.1,
    systolicDelta: -3.5,
    diastolicDelta: -2.0,
    organRiskDelta: {
      eyes: -4.5,
      kidneys: -5.5,
      nerves: -5.0,
      heart: -11.0,
    },
  },

  /**
   * Consistent medicine adherence (taking prescribed medicines regularly vs irregular)
   */
  medicineAdherenceBonus: {
    hba1cDelta: -0.65,
    systolicDelta: -8.5,
    diastolicDelta: -4.5,
    ldlDelta: -18.0,
    organRiskDelta: {
      eyes: -6.5,
      kidneys: -7.5,
      nerves: -6.0,
      heart: -9.5,
    },
  },

  /**
   * Baseline trajectories over 2, 5, and 10 years
   * - noChange: gradual upward drift when risk factors remain unaddressed
   * - currentAdherence: stabilization with prescribed routine
   * - improvedLifestyle: combined adherence + sustainable Indian food/walking/sleep habits
   */
  trajectories: {
    noChangeDriftPerYear: {
      hba1c: 0.14,
      systolic: 1.2,
      ldl: 2.0,
      egfr: -1.6,
      riskIndexDrift: 2.4,
    },
    adherenceDriftPerYear: {
      hba1c: -0.05,
      systolic: -0.8,
      ldl: -1.5,
      egfr: -0.7,
      riskIndexDrift: -1.2,
    },
    lifestyleDriftPerYear: {
      hba1c: -0.14,
      systolic: -1.8,
      ldl: -3.2,
      egfr: -0.4,
      riskIndexDrift: -2.8,
    },
  },
} as const;
