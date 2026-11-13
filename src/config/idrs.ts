/**
 * Published Madras Diabetes Research Foundation (MDRF) Indian Diabetes Risk Score (IDRS)
 * Reference: Mohan V, Deepa R, Deepa M, Somannavar S, Datta M.
 * "A simplified Indian Diabetes Risk Score for screening for undiagnosed diabetic subjects"
 * J Assoc Physicians India (JAPI) 2005; 53:759-763.
 *
 * Verified published cut-offs:
 * 1. Age:
 *    - < 35 years: 0
 *    - 35 to 49 years: 20
 *    - >= 50 years: 30
 * 2. Abdominal obesity (Waist circumference by sex):
 *    - Female < 80 cm, Male < 90 cm: 0
 *    - Female 80–89 cm, Male 90–99 cm: 10
 *    - Female >= 90 cm, Male >= 100 cm: 20
 * 3. Physical activity:
 *    - Vigorous exercise OR strenuous occupation: 0
 *    - Moderate exercise OR moderate physical activity at work/home: 10
 *    - Mild exercise OR light physical activity: 20
 *    - No exercise AND sedentary occupation: 30
 * 4. Family history of diabetes:
 *    - No family history: 0
 *    - Either parent has diabetes: 10
 *    - Both parents have diabetes: 20
 *
 * Maximum score = 100.
 * Published Risk Categories:
 * - Score < 30: Low risk
 * - Score 30 to 50: Moderate risk
 * - Score >= 60: High risk (sensitivity 72.5%, specificity 60.1% for screening undiagnosed diabetes)
 */

export const IDRS_CONFIG = {
  source: "Mohan V et al., Madras Diabetes Research Foundation (MDRF) IDRS, JAPI 2005; 53:759-763",
  lastReviewed: "2026-02-01",
  agePoints: {
    under35: 0,
    age35to49: 20,
    age50Plus: 30,
  },
  waistPoints: {
    female: {
      lowMaxCm: 79.9, // < 80 cm -> 0
      moderateMaxCm: 89.9, // 80-89 cm -> 10, >= 90 cm -> 20
    },
    male: {
      lowMaxCm: 89.9, // < 90 cm -> 0
      moderateMaxCm: 99.9, // 90-99 cm -> 10, >= 100 cm -> 20
    },
    points: {
      normal: 0,
      moderate: 10,
      high: 20,
    },
  },
  activityPoints: {
    vigorous_or_strenuous: 0,
    moderate: 10,
    mild: 20,
    sedentary: 30,
  },
  familyHistoryPoints: {
    none: 0,
    one_parent: 10,
    both_parents: 20,
  },
  cutoffs: {
    lowMax: 29, // < 30
    moderateMin: 30,
    moderateMax: 59, // 30 to 50 (since points are multiples of 10, 30, 40, 50 fall here)
    highMin: 60, // >= 60
  },
} as const;

export type IdrsActivityLevel = keyof typeof IDRS_CONFIG.activityPoints;
export type IdrsFamilyHistory = keyof typeof IDRS_CONFIG.familyHistoryPoints;

export interface PreventionQuestionnaireInput {
  age: number;
  sex: "male" | "female";
  waistCm: number;
  activityLevel: IdrsActivityLevel;
  familyHistory: IdrsFamilyHistory;
  // Additional holistic prevention factors
  sleepHours: number;
  dietPattern: "balanced_home" | "refined_carbs_frequent" | "high_salt_fried_snacks";
  tobaccoUse: "none" | "smoked" | "smokeless";
  restingHeartRateBpm?: number;
  stressLevel: "low" | "moderate" | "high";
}

export interface PreventionCheckResult {
  idrsScore: number;
  idrsBreakdown: {
    ageScore: number;
    waistScore: number;
    activityScore: number;
    familyScore: number;
  };
  riskBand: "Low" | "Moderate" | "High";
  cardiometabolicNote: string;
  earlyWarningSigns: string[];
  topActions: {
    title: string;
    whyItMatters: string;
    practicalStep: string;
  }[];
  recommendedScreeningTests: string[];
}

export function calculateIdrsAndPrevention(input: PreventionQuestionnaireInput): PreventionCheckResult {
  const ageScore =
    input.age < 35
      ? IDRS_CONFIG.agePoints.under35
      : input.age < 50
        ? IDRS_CONFIG.agePoints.age35to49
        : IDRS_CONFIG.agePoints.age50Plus;

  const waistThresholds =
    input.sex === "female" ? IDRS_CONFIG.waistPoints.female : IDRS_CONFIG.waistPoints.male;
  const waistScore =
    input.waistCm < (input.sex === "female" ? 80 : 90)
      ? IDRS_CONFIG.waistPoints.points.normal
      : input.waistCm < (input.sex === "female" ? 90 : 100)
        ? IDRS_CONFIG.waistPoints.points.moderate
        : IDRS_CONFIG.waistPoints.points.high;

  const activityScore = IDRS_CONFIG.activityPoints[input.activityLevel];
  const familyScore = IDRS_CONFIG.familyHistoryPoints[input.familyHistory];

  const idrsScore = ageScore + waistScore + activityScore + familyScore;

  const riskBand: "Low" | "Moderate" | "High" =
    idrsScore >= IDRS_CONFIG.cutoffs.highMin
      ? "High"
      : idrsScore >= IDRS_CONFIG.cutoffs.moderateMin
        ? "Moderate"
        : "Low";

  const actions: PreventionCheckResult["topActions"] = [];

  if (activityScore >= 20) {
    actions.push({
      title: "Walk 15 minutes after your two largest meals",
      whyItMatters:
        "Active muscles absorb glucose directly from the bloodstream after eating, blunting the post-meal sugar spike.",
      practicalStep:
        "Start with a 15-minute brisk walk 20 minutes after lunch and dinner—even inside your home or courtyard.",
    });
  }

  if (waistScore >= 10 || input.dietPattern !== "balanced_home") {
    actions.push({
      title: "Shift your plate proportion: half sabzi + salad, quarter dal/protein",
      whyItMatters:
        "Central waist fat in Indian adults strongly drives insulin resistance even at a normal body weight (the thin-fat phenotype).",
      practicalStep:
        "Replace one roti or half a katori of white rice with an extra bowl of non-starchy sabzi, sprouts, or dal.",
    });
  }

  if (input.tobaccoUse !== "none") {
    actions.push({
      title: "Step down tobacco (smoked or gutkha/khaini) with support",
      whyItMatters:
        "Nicotine stiffens blood vessels, raises blood pressure, and doubles the risk of kidney, eye, and heart damage.",
      practicalStep:
        "Speak with a doctor or call the National Tobacco Quitline (1800-11-2356) for a structured step-down plan.",
    });
  }

  if (input.sleepHours < 6.5 || input.stressLevel === "high") {
    actions.push({
      title: "Protect a steady 7 to 8 hour sleep window",
      whyItMatters:
        "Short sleep and high evening cortisol raise morning fasting blood sugar and blood pressure.",
      practicalStep:
        "Keep dinner at least 2 hours before bedtime and dim phone screens 30 minutes before sleeping.",
    });
  }

  if (input.dietPattern === "high_salt_fried_snacks") {
    actions.push({
      title: "Cut hidden salt in papad, achar, namkeen, and packaged snacks",
      whyItMatters:
        "Excess sodium holds extra fluid in blood vessels and raises blood pressure silently over years.",
      practicalStep:
        "Swap packaged namkeen and salted biscuits with unsalted roasted chana, makhana, or a handful of almonds/walnuts.",
    });
  }

  // Ensure we always have 3 top actions
  const defaultActions: PreventionCheckResult["topActions"] = [
    {
      title: "Schedule an annual baseline fasting blood & BP check",
      whyItMatters:
        "Both high blood sugar and high blood pressure usually have zero symptoms in the early years when they are easiest to reverse.",
      practicalStep:
        "Get a morning Fasting Blood Sugar, HbA1c, Lipid Profile, and seated Blood Pressure check once a year.",
    },
    {
      title: "Build muscle strength twice a week",
      whyItMatters:
        "Skeletal muscle is the body's main sink for blood sugar and protects metabolic health as we age.",
      practicalStep:
        "Do 15 minutes of chair squats, wall push-ups, or light resistance bands twice a week.",
    },
    {
      title: "Pair every carbohydrate with fibre or protein",
      whyItMatters:
        "Eating plain carbs (white rice, sweet chai, biscuits) alone causes rapid glucose swings and mid-day fatigue.",
      practicalStep:
        "Have curd, dal, paneer, or soaked nuts alongside meals, and avoid biscuits with morning chai.",
    },
  ];

  for (const fallback of defaultActions) {
    if (actions.length >= 3) break;
    if (!actions.some((a) => a.title === fallback.title)) {
      actions.push(fallback);
    }
  }

  const earlyWarningSigns = [
    "Unusual tiredness or drowsiness 1–2 hours after lunch or dinner",
    "Increased thirst, dry mouth, or waking up more than once at night to pass urine",
    "Darkened, velvety skin folds around the back of the neck or underarms (acanthosis nigricans — a sign of insulin resistance)",
    "Morning dull headaches or occasional dizziness (can accompany elevated blood pressure)",
    "Slow-healing small cuts or frequent gum irritation",
  ];

  const recommendedScreeningTests =
    riskBand === "High"
      ? [
          "HbA1c (3-month average blood sugar)",
          "Fasting Blood Glucose (FBS) & 2-hour Post-Meal Glucose (PPBS)",
          "Seated Blood Pressure (average of 2 readings after 5 minutes rest)",
          "Fasting Lipid Profile (Total, HDL, LDL, Triglycerides)",
          "Serum Creatinine & Urine Albumin-to-Creatinine Ratio (ACR)",
        ]
      : riskBand === "Moderate"
        ? [
            "HbA1c and Fasting Blood Glucose",
            "Seated Blood Pressure check",
            "Fasting Lipid Profile",
          ]
        : [
            "Routine Seated Blood Pressure check every year",
            "Fasting Blood Sugar or HbA1c every 1–2 years",
          ];

  let cardiometabolicNote =
    riskBand === "High"
      ? `Your Indian Diabetes Risk Score is ${idrsScore}/100 (High screening band, ≥60). Published Indian studies recommend a simple lab screening test (HbA1c and Fasting Glucose) so you can catch any rise early.`
      : riskBand === "Moderate"
        ? `Your Indian Diabetes Risk Score is ${idrsScore}/100 (Moderate band, 30–50). Small daily adjustments in waist size and post-meal walking can move your risk downward.`
        : `Your Indian Diabetes Risk Score is ${idrsScore}/100 (Low band, <30). Keep up your current movement and home-cooked meal habits.`;

  if (input.restingHeartRateBpm && input.restingHeartRateBpm > 85) {
    cardiometabolicNote += ` Your resting heart rate (${input.restingHeartRateBpm} bpm) is on the higher side of normal; regular walking and better sleep help improve cardiovascular fitness.`;
  }

  return {
    idrsScore,
    idrsBreakdown: {
      ageScore,
      waistScore,
      activityScore,
      familyScore,
    },
    riskBand,
    cardiometabolicNote,
    earlyWarningSigns,
    topActions: actions.slice(0, 3),
    recommendedScreeningTests,
  };
}
