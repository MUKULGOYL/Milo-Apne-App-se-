import { CallEExplainResponse, DocumentType, SAMPLE_REPORTS } from "./extract";
import {
  DEFAULT_TREND_ALERT_CONFIG,
  DeterministicEngineOutput,
  runDeterministicEngine,
  TrendAlertRuleConfig,
} from "./engine";
import { SupportedLanguage } from "./i18n";
import { normalizeExtractedTests, NormalizedTestValue } from "./normalize";

/**
 * Data Model (TypeScript types, persisted in localStorage with try/catch and in-memory fallback)
 * Profile {id, label (Self/Father/Mother/Other), ageBand or age, sex, heightCm, weightKg, waistCm, conditions[], language}
 * Report {id, profileId, date, type, values[], engineOutput, narrative, createdAt}
 * Reading {id, profileId, kind (glucose|bp|weight|heart_rate|steps|sleep), value(s), context (fasting|after meal|random), time, source}
 * Medicine {id, profileId, name, note, times[], active, takenDates[]}
 * Settings {language, largeText, darkMode, consentAccepted, consentDate, biometricLockEnabled, familySharePermissions}
 */

export type ProfileLabel = "Self" | "Father" | "Mother" | "Other";

export interface Profile {
  id: string;
  label: ProfileLabel;
  customName: string;
  age: number;
  ageBand?: string;
  sex: "male" | "female";
  heightCm: number;
  weightKg: number;
  waistCm: number;
  conditions: string[];
  tobaccoUse?: boolean;
  diabetesDurationYears?: number;
  language: SupportedLanguage;
  sharePermission?: "private" | "view_summary" | "full_family";
}

export interface Report {
  id: string;
  profileId: string;
  date: string;
  labName: string;
  type: DocumentType;
  isSample?: boolean;
  pathologyTerms?: { term: string; contextAsPrinted: string }[];
  values: NormalizedTestValue[];
  engineOutput: DeterministicEngineOutput;
  narrative: CallEExplainResponse | null;
  createdAt: string;
}

export type ReadingKind = "glucose" | "bp" | "weight" | "heart_rate" | "steps" | "sleep";
export type ReadingContext = "fasting" | "after meal" | "random" | "morning" | "evening" | "wearable_auto";

export interface Reading {
  id: string;
  profileId: string;
  kind: ReadingKind;
  value: number; // Primary value (glucose mg/dL, systolic mmHg, weight kg, HR bpm, steps, sleep hrs)
  secondaryValue?: number; // Diastolic mmHg for BP
  pulseValue?: number; // Pulse bpm for BP monitor
  context: ReadingContext;
  time: string; // ISO timestamp
  source?: "manual" | "scanned_monitor" | "wearable_sync";
  deviceName?: string;
}

export interface Medicine {
  id: string;
  profileId: string;
  name: string;
  note: string; // User-entered note only, never dosing advice
  times: string[]; // e.g., ["08:00", "20:30"]
  active: boolean;
  adherenceLog: Record<string, boolean>; // key: "YYYY-MM-DD_HH:mm" -> true
}

export interface AppointmentReminder {
  id: string;
  profileId: string;
  title: string;
  doctorOrLab: string;
  date: string;
  time: string;
  notes: string;
}

export interface Settings {
  language: SupportedLanguage;
  largeText: boolean;
  darkMode: boolean;
  consentAccepted: boolean;
  consentDate: string | null;
  notificationsEnabled: boolean;
  biometricPasskeyRegistered: boolean;
  encryptedCloudVaultLastSync?: string | null;
  trendAlertConfig?: TrendAlertRuleConfig;
}

export interface AppStateData {
  profiles: Profile[];
  activeProfileId: string;
  reports: Report[];
  readings: Reading[];
  medicines: Medicine[];
  appointments: AppointmentReminder[];
  settings: Settings;
  explainCache: Record<string, CallEExplainResponse>;
}

const STORAGE_KEY = "milo_health_app_state_v1";
let memoryFallbackStore: AppStateData | null = null;

function createInitialSampleReport(profile: Profile): Report {
  const preset = SAMPLE_REPORTS[0];
  const values = normalizeExtractedTests(
    preset.rawTests.map((t) => ({ ...t, confidence: 0.98, needsCheck: false }))
  );
  const engineOutput = runDeterministicEngine(
    values,
    {
      age: profile.age,
      sex: profile.sex,
      heightCm: profile.heightCm,
      weightKg: profile.weightKg,
      waistCm: profile.waistCm,
      conditions: profile.conditions,
      tobaccoUse: profile.tobaccoUse,
      diabetesDurationYears: profile.diabetesDurationYears,
    },
    preset.documentType
  );

  const defaultNarrative: CallEExplainResponse = {
    summary:
      "This sample report shows blood sugar in the diabetes range (HbA1c 7.6%, Fasting 148 mg/dL, Post-meal 214 mg/dL) alongside Stage 1 blood pressure (138/86 mmHg), elevated LDL cholesterol (142 mg/dL), and early kidney filter strain (Urine ACR 44 mg/g with calculated eGFR 72.1 mL/min/1.73m²). These markers move together—and steady improvements in post-meal walking, plate proportions, salt reduction, and regular doctor-guided care can meaningfully lower strain on your heart, kidneys, eyes, and nerves.",
    whyItHappens:
      "After meals rich in refined carbohydrates, blood glucose rises quickly. When cells are less responsive to insulin (often linked to waist circumference and low muscle activity), extra glucose stays in the bloodstream longer and attaches to haemoglobin (raising HbA1c). Over time, higher sugar and higher blood pressure (138/86 mmHg) create extra pressure inside tiny blood vessels in the kidneys (causing small amounts of albumin protein, 44 mg/g, to pass into the urine) and eyes.",
    organNotes: {
      eyes: "Small retinal vessels are sensitive to both HbA1c (7.6%) and blood pressure (138/86 mmHg). An annual dilated eye check helps ensure the retina stays healthy.",
      kidneys:
        "Your calculated eGFR is 72.1 mL/min/1.73m² (Stage G2) and Urine ACR is 44 mg/g (Category A2). Keeping blood pressure below 130/80 mmHg and reducing dietary salt directly reduces pressure on kidney filters.",
      nerves:
        "Sustained HbA1c above 7.0% can gradually irritate peripheral nerves in the feet. Walking daily and bringing HbA1c closer to target protects nerve health.",
      heart:
        "LDL cholesterol (142 mg/dL), triglycerides (194 mg/dL), and low HDL (38 mg/dL) combine with blood pressure to increase vascular strain. Swapping fried snacks for nuts, dal, and sabzi plus regular brisk walks helps improve this lipid pattern.",
    },
    roadmap: [
      {
        timeframe: "Next 7 days",
        title: "Start a 15-minute brisk walk after lunch and dinner",
        detail:
          "Walking within 20–30 minutes after your two main meals helps muscles absorb post-meal sugar (currently 214 mg/dL) without extra insulin strain.",
      },
      {
        timeframe: "Next 2–4 weeks",
        title: "Rebalance the Indian thali & cut hidden sodium",
        detail:
          "Fill half your plate with sabzi and salad, one-quarter with dal/curd/paneer, and one-quarter with whole wheat roti or brown/hand-pounded rice. Avoid papad, achar, and salted namkeen to help lower BP from 138/86 mmHg.",
      },
      {
        timeframe: "Next 3 months",
        title: "Review report with your physician & re-check HbA1c + Urine ACR",
        detail:
          "Share your questions with your doctor to review your blood sugar, cholesterol, Vitamin D (16.4 ng/mL), and kidney protection plan.",
      },
    ],
    doctorQuestions: [
      "What personal HbA1c and blood pressure targets do you recommend for me over the next 3 months?",
      "Since my Urine ACR is 44 mg/g and calculated eGFR is 72.1, what steps should we take to protect my kidneys?",
      "Given my LDL cholesterol of 142 mg/dL and triglycerides of 194 mg/dL, how much can diet changes achieve and what follow-up lipid test do I need?",
      "My Vitamin D is 16.4 ng/mL—how should we safely correct this deficiency?",
      "Should I schedule a routine dilated retina eye exam this year?",
    ],
    glossaryTerms: [
      {
        term: "HbA1c (Glycosylated Hemoglobin)",
        plainMeaning:
          "Measures the percentage of haemoglobin coated with sugar over the past 8–12 weeks, giving a steady 3-month average unaffected by a single meal.",
      },
      {
        term: "eGFR (Estimated Glomerular Filtration Rate)",
        plainMeaning:
          "An estimate of how many millilitres of blood your kidneys filter every minute. Above 90 is normal; 60–89 is mildly decreased.",
      },
      {
        term: "Urine ACR (Albumin-to-Creatinine Ratio)",
        plainMeaning:
          "Checks if tiny amounts of a healthy blood protein (albumin) are leaking through the kidney filters into urine. Below 30 mg/g is normal.",
      },
      {
        term: "LDL & HDL Cholesterol",
        plainMeaning:
          "LDL carries cholesterol that can deposit in artery walls (lower is better), while HDL helps clear excess cholesterol back to the liver (higher is better).",
      },
    ],
    sevenDayPlan: [
      {
        day: "Day 1 (Monday)",
        breakfast: "Vegetable moong dal chilla (2) with mint chutney + unsweetened chai",
        lunch: "1 bowl palak methi sabzi + 1 bowl thick toor dal + 1 cucumber salad + 1–2 multigrain rotis",
        eveningSnack: "1 small bowl roasted chana + 5 soaked almonds",
        dinner: "Lauki (bottle gourd) sabzi + moong dal soup + 1 phulka (2 hrs before sleep)",
        movementAndSleep: "15-min walk after lunch & dinner · Low salt (<5g/day) · Sleep by 10:30 PM (7.5 hrs)",
      },
      {
        day: "Day 2 (Tuesday)",
        breakfast: "Steel-cut/rolled oats or vegetablealiya upma with beans, carrots & peanuts",
        lunch: "Bhindi masala (low oil) + rajma bowl + kachumber salad + 1 roti or small bowl brown rice",
        eveningSnack: "1 cup buttermilk (chaas) with roasted jeera (no salt) + walnuts",
        dinner: "Grilled paneer/tofu bhurji with capsicum + mixed vegetable soup + 1 roti",
        movementAndSleep: "15-min post-meal walk + 10 mins light chair squats · 7.5 hrs sleep",
      },
      {
        day: "Day 3 (Wednesday)",
        breakfast: "2 idlis with thick vegetable sambar (extra drumsticks/carrots) + coconut-peanut chutney",
        lunch: "Tinda/parwal sabzi + chana dal + bowl of curd + 1–2 whole wheat rotis",
        eveningSnack: "Roasted makhana (foxnuts) tossed in a drop of ghee & black pepper",
        dinner: "Methi matar malai (made with curd instead of cream) + dal tadka + 1 phulka",
        movementAndSleep: "20-min brisk evening walk · Avoid screens 30 mins before bed",
      },
      {
        day: "Day 4 (Thursday)",
        breakfast: "Besan omelette / pudla with grated carrot, spinach, tomato + unsweetened tea",
        lunch: "Cabbage-peas sabzi + lobia (black-eyed peas) curry + salad + 1–2 rotis",
        eveningSnack: "1 small guava or apple with skin + 1 tbsp pumpkin seeds",
        dinner: "Ridge gourd (turai) sabzi + yellow moong dal + 1 multigrain roti",
        movementAndSleep: "15-min walk after lunch & dinner · Check evening seated BP",
      },
      {
        day: "Day 5 (Friday)",
        breakfast: "Vegetable poha (half portion) topped with 1 bowl sprouted moong & sev omitted",
        lunch: "Baingan bharta + masoor dal + cucumber raita + 1–2 phulkas",
        eveningSnack: "Unsalted roasted peanuts + green/herbal tea",
        dinner: "Mixed vegetable khichdi (2 parts moong dal : 1 part rice) with 1 bowl kadhi",
        movementAndSleep: "15-min walk after meals + 10 mins upper-body resistance · 7.5 hrs sleep",
      },
      {
        day: "Day 6 (Saturday)",
        breakfast: "Ragi dosa (2) with vegetable sambar and tomato-onion chutney",
        lunch: "Cauliflower-beans sabzi + kala chana curry + carrot-radish salad + 1–2 rotis",
        eveningSnack: "Sprouts chaat with lemon, onion, coriander, tomato (no sev/boondi)",
        dinner: "Palak paneer (low oil) + clear vegetable lentil soup + 1 phulka",
        movementAndSleep: "30-min morning park walk + 15-min post-dinner walk",
      },
      {
        day: "Day 7 (Sunday)",
        breakfast: "Stuffed methi/mooli paratha (1, roasted with minimal ghee) + 1 full bowl plain curd (no pickle)",
        lunch: "Home-style fish curry or soya chunk curry + sautéed French beans + small bowl rice or 1 roti",
        eveningSnack: "1 small bowl papaya or pear + 4 almonds & 2 walnuts",
        dinner: "Light vegetable daliya khichdi with bottle gourd & spinach",
        movementAndSleep: "Family evening walk (25 mins) · Prep weekly medicine box · 8 hrs sleep",
      },
    ],
  };

  return {
    id: "report-sample-initial",
    profileId: profile.id,
    date: "2026-10-15",
    labName: preset.labName,
    type: preset.documentType,
    isSample: true,
    values,
    engineOutput,
    narrative: defaultNarrative,
    createdAt: "2026-10-15T09:00:00.000Z",
  };
}

function getDefaultState(): AppStateData {
  const selfProfile: Profile = {
    id: "profile-self",
    label: "Self",
    customName: "Aarav Sharma (Self)",
    age: 46,
    sex: "male",
    heightCm: 171,
    weightKg: 78,
    waistCm: 94,
    conditions: ["Prediabetes / Type 2 Diabetes screening", "Elevated BP"],
    tobaccoUse: false,
    diabetesDurationYears: 2,
    language: "en",
    sharePermission: "full_family",
  };

  const fatherProfile: Profile = {
    id: "profile-father",
    label: "Father",
    customName: "Rajesh Sharma (Father)",
    age: 68,
    sex: "male",
    heightCm: 168,
    weightKg: 72,
    waistCm: 96,
    conditions: ["Type 2 Diabetes", "Hypertension"],
    tobaccoUse: false,
    diabetesDurationYears: 12,
    language: "hi",
    sharePermission: "full_family",
  };

  const motherProfile: Profile = {
    id: "profile-mother",
    label: "Mother",
    customName: "Sunita Sharma (Mother)",
    age: 63,
    sex: "female",
    heightCm: 156,
    weightKg: 64,
    waistCm: 86,
    conditions: ["Hypertension"],
    tobaccoUse: false,
    diabetesDurationYears: 0,
    language: "hi",
    sharePermission: "view_summary",
  };

  const sampleReport = createInitialSampleReport(selfProfile);

  // Create two earlier sample reports (12 months prior and 6 months prior) so 3-consecutive trend detection and History & Compare work immediately out of the box
  const oldestValues = normalizeExtractedTests([
    {
      canonicalName: "hba1c",
      nameAsPrinted: "HbA1c",
      value: 6.8,
      unit: "%",
      refLow: 4.0,
      refHigh: 5.6,
      confidence: 0.99,
      page: 1,
    },
    {
      canonicalName: "fasting_glucose",
      nameAsPrinted: "Fasting Blood Sugar",
      value: 126,
      unit: "mg/dL",
      refLow: 70,
      refHigh: 99,
      confidence: 0.99,
      page: 1,
    },
    {
      canonicalName: "systolic_bp",
      nameAsPrinted: "Systolic BP",
      value: 128,
      unit: "mmHg",
      refLow: 90,
      refHigh: 119,
      confidence: 0.99,
      page: 1,
    },
    {
      canonicalName: "diastolic_bp",
      nameAsPrinted: "Diastolic BP",
      value: 80,
      unit: "mmHg",
      refLow: 60,
      refHigh: 79,
      confidence: 0.99,
      page: 1,
    },
    {
      canonicalName: "ldl_cholesterol",
      nameAsPrinted: "LDL Cholesterol",
      value: 124,
      unit: "mg/dL",
      refLow: 0,
      refHigh: 99,
      confidence: 0.99,
      page: 1,
    },
    {
      canonicalName: "creatinine",
      nameAsPrinted: "Serum Creatinine",
      value: 1.04,
      unit: "mg/dL",
      refLow: 0.7,
      refHigh: 1.2,
      confidence: 0.99,
      page: 1,
    },
    {
      canonicalName: "urine_acr",
      nameAsPrinted: "Urine ACR",
      value: 28,
      unit: "mg/g",
      refLow: 0,
      refHigh: 30,
      confidence: 0.99,
      page: 1,
    },
  ]);

  const oldestEngine = runDeterministicEngine(
    oldestValues,
    {
      age: selfProfile.age,
      sex: selfProfile.sex,
      heightCm: selfProfile.heightCm,
      weightKg: selfProfile.weightKg,
      waistCm: selfProfile.waistCm,
      conditions: selfProfile.conditions,
    },
    "blood"
  );

  const oldestReport: Report = {
    id: "report-sample-oldest",
    profileId: selfProfile.id,
    date: "2025-10-10",
    labName: "Sample — MetroPath Diagnostics (12 Months Earlier)",
    type: "blood",
    isSample: true,
    values: oldestValues,
    engineOutput: oldestEngine,
    narrative: sampleReport.narrative,
    createdAt: "2025-10-10T09:00:00.000Z",
  };

  const earlierValues = normalizeExtractedTests([
    {
      canonicalName: "hba1c",
      nameAsPrinted: "HbA1c",
      value: 7.2,
      unit: "%",
      refLow: 4.0,
      refHigh: 5.6,
      confidence: 0.99,
      page: 1,
    },
    {
      canonicalName: "fasting_glucose",
      nameAsPrinted: "Fasting Blood Sugar",
      value: 136,
      unit: "mg/dL",
      refLow: 70,
      refHigh: 99,
      confidence: 0.99,
      page: 1,
    },
    {
      canonicalName: "systolic_bp",
      nameAsPrinted: "Systolic BP",
      value: 133,
      unit: "mmHg",
      refLow: 90,
      refHigh: 119,
      confidence: 0.99,
      page: 1,
    },
    {
      canonicalName: "diastolic_bp",
      nameAsPrinted: "Diastolic BP",
      value: 83,
      unit: "mmHg",
      refLow: 60,
      refHigh: 79,
      confidence: 0.99,
      page: 1,
    },
    {
      canonicalName: "ldl_cholesterol",
      nameAsPrinted: "LDL Cholesterol",
      value: 134,
      unit: "mg/dL",
      refLow: 0,
      refHigh: 99,
      confidence: 0.99,
      page: 1,
    },
    {
      canonicalName: "creatinine",
      nameAsPrinted: "Serum Creatinine",
      value: 1.11,
      unit: "mg/dL",
      refLow: 0.7,
      refHigh: 1.2,
      confidence: 0.99,
      page: 1,
    },
    {
      canonicalName: "urine_acr",
      nameAsPrinted: "Urine ACR",
      value: 36,
      unit: "mg/g",
      refLow: 0,
      refHigh: 30,
      confidence: 0.99,
      page: 1,
    },
  ]);

  const earlierEngine = runDeterministicEngine(
    earlierValues,
    {
      age: selfProfile.age,
      sex: selfProfile.sex,
      heightCm: selfProfile.heightCm,
      weightKg: selfProfile.weightKg,
      waistCm: selfProfile.waistCm,
      conditions: selfProfile.conditions,
    },
    "blood"
  );

  const earlierReport: Report = {
    id: "report-sample-earlier",
    profileId: selfProfile.id,
    date: "2026-04-12",
    labName: "Sample — MetroPath Diagnostics (6 Months Earlier)",
    type: "blood",
    isSample: true,
    values: earlierValues,
    engineOutput: earlierEngine,
    narrative: sampleReport.narrative,
    createdAt: "2026-04-12T09:00:00.000Z",
  };

  const now = Date.now();
  const dayMs = 86_400_000;

  const sampleReadings: Reading[] = [
    {
      id: "read-1",
      profileId: selfProfile.id,
      kind: "glucose",
      value: 112,
      context: "fasting",
      time: new Date(now - 6 * dayMs).toISOString(),
      source: "manual",
    },
    {
      id: "read-2",
      profileId: selfProfile.id,
      kind: "glucose",
      value: 144,
      context: "after meal",
      time: new Date(now - 5 * dayMs).toISOString(),
      source: "manual",
    },
    {
      id: "read-3",
      profileId: selfProfile.id,
      kind: "glucose",
      value: 116,
      context: "fasting",
      time: new Date(now - 4 * dayMs).toISOString(),
      source: "manual",
    },
    {
      id: "read-4",
      profileId: selfProfile.id,
      kind: "glucose",
      value: 118,
      context: "fasting",
      time: new Date(now - 3 * dayMs).toISOString(),
      source: "manual",
    },
    {
      id: "read-5",
      profileId: selfProfile.id,
      kind: "glucose",
      value: 126,
      context: "fasting",
      time: new Date(now - 2 * dayMs).toISOString(),
      source: "manual",
    },
    {
      id: "read-6",
      profileId: selfProfile.id,
      kind: "glucose",
      value: 135,
      context: "fasting",
      time: new Date(now - 1 * dayMs).toISOString(),
      source: "manual",
    },
    {
      id: "read-bp-1",
      profileId: selfProfile.id,
      kind: "bp",
      value: 128,
      secondaryValue: 81,
      pulseValue: 72,
      context: "morning",
      time: new Date(now - 5 * dayMs).toISOString(),
      source: "manual",
    },
    {
      id: "read-bp-2",
      profileId: selfProfile.id,
      kind: "bp",
      value: 133,
      secondaryValue: 84,
      pulseValue: 74,
      context: "morning",
      time: new Date(now - 3 * dayMs).toISOString(),
      source: "manual",
    },
    {
      id: "read-bp-3",
      profileId: selfProfile.id,
      kind: "bp",
      value: 138,
      secondaryValue: 87,
      pulseValue: 76,
      context: "morning",
      time: new Date(now - 1 * dayMs).toISOString(),
      source: "wearable_sync",
      deviceName: "Omron BLE / Health Bridge",
    },
    {
      id: "read-wt-1",
      profileId: selfProfile.id,
      kind: "weight",
      value: 78.6,
      context: "morning",
      time: new Date(now - 6 * dayMs).toISOString(),
      source: "manual",
    },
    {
      id: "read-wt-2",
      profileId: selfProfile.id,
      kind: "weight",
      value: 78.0,
      context: "morning",
      time: new Date(now - 1 * dayMs).toISOString(),
      source: "manual",
    },
    {
      id: "read-hr-1",
      profileId: selfProfile.id,
      kind: "heart_rate",
      value: 72,
      context: "wearable_auto",
      time: new Date(now - 3600_000).toISOString(),
      source: "wearable_sync",
      deviceName: "Smartwatch HR Sensor",
    },
    {
      id: "read-steps-1",
      profileId: selfProfile.id,
      kind: "steps",
      value: 7420,
      context: "wearable_auto",
      time: new Date(now - 1800_000).toISOString(),
      source: "wearable_sync",
      deviceName: "Smartwatch Pedometer",
    },
    {
      id: "read-sleep-1",
      profileId: selfProfile.id,
      kind: "sleep",
      value: 7.4,
      context: "wearable_auto",
      time: new Date(now - 28800_000).toISOString(),
      source: "wearable_sync",
      deviceName: "Smartwatch Sleep Tracker",
    },
  ];

  const todayKey = new Date().toISOString().slice(0, 10);
  const sampleMedicines: Medicine[] = [
    {
      id: "med-1",
      profileId: selfProfile.id,
      name: "Morning prescribed tablet (user note)",
      note: "After breakfast with water (entered by user — always follow doctor's prescription)",
      times: ["08:30"],
      active: true,
      adherenceLog: {
        [`${todayKey}_08:30`]: true,
      },
    },
    {
      id: "med-2",
      profileId: selfProfile.id,
      name: "Evening prescribed tablet (user note)",
      note: "With dinner (entered by user — no dosing advice provided by Milo)",
      times: ["20:30"],
      active: true,
      adherenceLog: {},
    },
  ];

  const sampleAppointments: AppointmentReminder[] = [
    {
      id: "appt-1",
      profileId: selfProfile.id,
      title: "3-Month HbA1c & Urine ACR Follow-up",
      doctorOrLab: "Dr. Meera Nair (Internal Medicine)",
      date: "2026-12-01",
      time: "10:00",
      notes: "Bring home blood pressure and fasting sugar log",
    },
  ];

  return {
    profiles: [selfProfile, fatherProfile, motherProfile],
    activeProfileId: selfProfile.id,
    reports: [sampleReport, earlierReport, oldestReport],
    readings: sampleReadings,
    medicines: sampleMedicines,
    appointments: sampleAppointments,
    settings: {
      language: "en",
      largeText: false,
      darkMode: false,
      consentAccepted: false,
      consentDate: null,
      notificationsEnabled: false,
      biometricPasskeyRegistered: false,
      encryptedCloudVaultLastSync: null,
      trendAlertConfig: DEFAULT_TREND_ALERT_CONFIG,
    },
    explainCache: {},
  };
}

export function loadAppState(): AppStateData {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppStateData;
      if (parsed && Array.isArray(parsed.profiles) && parsed.profiles.length > 0) {
        memoryFallbackStore = parsed;
        return parsed;
      }
    }
  } catch {
    if (memoryFallbackStore) return memoryFallbackStore;
  }

  const initial = getDefaultState();
  saveAppState(initial);
  return initial;
}

export function saveAppState(state: AppStateData): void {
  memoryFallbackStore = state;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Fallback to in-memory store if localStorage is full or blocked in private iframe
  }
}

/**
 * End-to-End AES-GCM 256-bit Encryption helper using the browser's native Web Crypto API
 * for encrypted personal health record backup and restore.
 */
export async function encryptHealthBackup(
  state: AppStateData,
  passphrase: string
): Promise<string> {
  const enc = new TextEncoder();
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  const key = await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );

  const plaintext = enc.encode(JSON.stringify(state));
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintext
  );

  const payload = {
    v: 1,
    alg: "AES-256-GCM-PBKDF2",
    createdAt: new Date().toISOString(),
    salt: btoa(String.fromCharCode(...salt)),
    iv: btoa(String.fromCharCode(...iv)),
    data: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
  };

  return JSON.stringify(payload, null, 2);
}

export async function decryptHealthBackup(
  encryptedJson: string,
  passphrase: string
): Promise<AppStateData> {
  const payload = JSON.parse(encryptedJson);
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const salt = Uint8Array.from(atob(payload.salt), (c) => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(payload.iv), (c) => c.charCodeAt(0));
  const ciphertext = Uint8Array.from(atob(payload.data), (c) => c.charCodeAt(0));

  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  const key = await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 100_000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  const decrypted = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );

  return JSON.parse(dec.decode(decrypted)) as AppStateData;
}
