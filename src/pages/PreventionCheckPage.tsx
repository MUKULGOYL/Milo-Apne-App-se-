import React, { useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  HeartPulse,
  ShieldAlert,
} from "lucide-react";
import {
  calculateIdrsAndPrevention,
  IDRS_CONFIG,
  IdrsActivityLevel,
  IdrsFamilyHistory,
  PreventionQuestionnaireInput,
} from "../config/idrs";
import { Profile } from "../lib/storage";

const SYMPTOM_EDUCATIONAL_CARDS = [
  {
    id: "thirst_urination",
    label: "Frequent thirst, dry mouth, or waking up at night to pass urine",
    urgency: "routine_soon" as const,
    explanation:
      "When blood glucose rises above the kidney threshold (~180 mg/dL), the kidneys draw extra water into urine. Schedule a simple morning Fasting Blood Sugar and HbA1c test with your doctor.",
  },
  {
    id: "post_meal_fatigue",
    label: "Heavy drowsiness or fatigue 60–90 minutes after lunch or dinner",
    urgency: "routine_soon" as const,
    explanation:
      "Often caused by a rapid blood sugar spike and dip after refined carbohydrate meals. Try a 15-minute walk after meals and check HbA1c.",
  },
  {
    id: "chest_shortness",
    label: "Chest heaviness, sudden shortness of breath, or BP ≥180/120 mmHg",
    urgency: "urgent_today" as const,
    explanation:
      "Please contact a doctor or visit urgent care today. Do not wait or attempt to walk off chest discomfort or severely elevated blood pressure.",
  },
  {
    id: "foot_tingling",
    label: "Tingling, burning, or numbness in toes or feet at night",
    urgency: "routine_soon" as const,
    explanation:
      "Can reflect peripheral nerve irritation from elevated blood sugar or low Vitamin B12. Ask your doctor to check your feet, HbA1c, and Vitamin B12.",
  },
];

export function PreventionCheckPage({ profile }: { profile: Profile }) {
  const [input, setInput] = useState<PreventionQuestionnaireInput>({
    age: profile.age || 45,
    sex: profile.sex || "male",
    waistCm: profile.waistCm || 92,
    activityLevel: "mild",
    familyHistory: "one_parent",
    sleepHours: 6.5,
    dietPattern: "refined_carbs_frequent",
    tobaccoUse: profile.tobaccoUse ? "smoked" : "none",
    restingHeartRateBpm: 76,
    stressLevel: "moderate",
  });

  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);

  const result = useMemo(() => calculateIdrsAndPrevention(input), [input]);

  const toggleSymptom = (id: string) => {
    setSelectedSymptoms((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-teal-700 dark:text-teal-400">
          <ClipboardCheck className="w-4 h-4" />
          <span>3-Minute Prevention Check · No Lab Report Needed</span>
        </div>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
          Indian Diabetes Risk Score (IDRS) & Cardiometabolic Prevention Check
        </h1>
        <p className="text-xs text-slate-500">
          Uses the published Madras Diabetes Research Foundation (MDRF) Indian Diabetes Risk Score cut-offs ({IDRS_CONFIG.source}) plus sleep, diet, tobacco, resting heart rate, and stress.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Questionnaire Form */}
        <div className="lg:col-span-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            01. MDRF Indian Diabetes Risk Score (IDRS) Inputs
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Age (Years)
              </label>
              <input
                type="number"
                min={18}
                max={100}
                value={input.age}
                onChange={(e) =>
                  setInput((p) => ({ ...p, age: Number(e.target.value) }))
                }
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Biological Sex
              </label>
              <select
                value={input.sex}
                onChange={(e) =>
                  setInput((p) => ({
                    ...p,
                    sex: e.target.value as "male" | "female",
                  }))
                }
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Waist Circumference (cm)
              </label>
              <input
                type="number"
                min={55}
                max={150}
                value={input.waistCm}
                onChange={(e) =>
                  setInput((p) => ({ ...p, waistCm: Number(e.target.value) }))
                }
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono tabular-nums"
              />
              <span className="text-[10px] text-slate-400">
                Indian cut-off: {input.sex === "female" ? "<80cm normal" : "<90cm normal"}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Daily Physical Activity (Work + Exercise)
            </label>
            <select
              value={input.activityLevel}
              onChange={(e) =>
                setInput((p) => ({
                  ...p,
                  activityLevel: e.target.value as IdrsActivityLevel,
                }))
              }
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
            >
              <option value="vigorous_or_strenuous">
                Regular vigorous exercise OR strenuous manual work (0 pts)
              </option>
              <option value="moderate">
                Moderate exercise / brisk walking daily OR active household/work (10 pts)
              </option>
              <option value="mild">
                Mild / occasional walking AND mostly seated work (20 pts)
              </option>
              <option value="sedentary">
                No regular exercise AND sedentary desk/home routine (30 pts)
              </option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Family History of Diabetes (Parents)
            </label>
            <select
              value={input.familyHistory}
              onChange={(e) =>
                setInput((p) => ({
                  ...p,
                  familyHistory: e.target.value as IdrsFamilyHistory,
                }))
              }
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
            >
              <option value="none">Neither parent has diabetes (0 pts)</option>
              <option value="one_parent">One parent has diabetes (10 pts)</option>
              <option value="both_parents">Both parents have diabetes (20 pts)</option>
            </select>
          </div>

          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 pt-4 border-t border-slate-200 dark:border-slate-800">
            02. Sleep, Diet Pattern, Tobacco, Heart Rate & Stress
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Usual Meal Pattern
              </label>
              <select
                value={input.dietPattern}
                onChange={(e) =>
                  setInput((p) => ({ ...p, dietPattern: e.target.value as any }))
                }
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
              >
                <option value="balanced_home">
                  Home-cooked with plenty of sabzi, dal & whole grains
                </option>
                <option value="refined_carbs_frequent">
                  Large rice/roti portions, sweet chai, or biscuits daily
                </option>
                <option value="high_salt_fried_snacks">
                  Frequent namkeen, papad, achar, fried snacks, or outside food
                </option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Tobacco Use (Smoked or Gutkha/Khaini)
              </label>
              <select
                value={input.tobaccoUse}
                onChange={(e) =>
                  setInput((p) => ({ ...p, tobaccoUse: e.target.value as any }))
                }
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
              >
                <option value="none">No tobacco</option>
                <option value="smoked">Smoked (Cigarettes / Bidi)</option>
                <option value="smokeless">Smokeless (Gutkha / Khaini / Zarda)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Average Sleep (Hours/Night)
              </label>
              <input
                type="number"
                step="0.5"
                min={3}
                max={12}
                value={input.sleepHours}
                onChange={(e) =>
                  setInput((p) => ({ ...p, sleepHours: Number(e.target.value) }))
                }
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Resting Heart Rate (BPM)
              </label>
              <input
                type="number"
                min={45}
                max={130}
                value={input.restingHeartRateBpm}
                onChange={(e) =>
                  setInput((p) => ({
                    ...p,
                    restingHeartRateBpm: Number(e.target.value),
                  }))
                }
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono tabular-nums"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Daily Stress Load
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["low", "moderate", "high"] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setInput((p) => ({ ...p, stressLevel: lvl }))}
                  className={`py-2 text-xs font-semibold rounded-lg border capitalize transition-colors ${
                    input.stressLevel === lvl
                      ? "border-teal-700 bg-teal-50 dark:bg-teal-950/50 text-teal-900 dark:text-teal-200"
                      : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results Column */}
        <div className="lg:col-span-6 space-y-6">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <span className="text-xs text-slate-500">
                  Published MDRF Cut-offs (&lt;30 Low · 30–50 Moderate · ≥60 High)
                </span>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5 tabular-nums">
                  IDRS Score: {result.idrsScore} / 100 — {result.riskBand} Screening Band
                </h2>
              </div>
              <HeartPulse className="w-7 h-7 text-teal-700 shrink-0" />
            </div>

            <div className="grid grid-cols-4 gap-2 text-center text-xs tabular-nums">
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                <div className="text-slate-500">Age</div>
                <div className="font-bold text-slate-900 dark:text-slate-100">
                  +{result.idrsBreakdown.ageScore}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                <div className="text-slate-500">Waist</div>
                <div className="font-bold text-slate-900 dark:text-slate-100">
                  +{result.idrsBreakdown.waistScore}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                <div className="text-slate-500">Activity</div>
                <div className="font-bold text-slate-900 dark:text-slate-100">
                  +{result.idrsBreakdown.activityScore}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                <div className="text-slate-500">Family</div>
                <div className="font-bold text-slate-900 dark:text-slate-100">
                  +{result.idrsBreakdown.familyScore}
                </div>
              </div>
            </div>

            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {result.cardiometabolicNote}
            </p>

            {/* Top 3 Actions */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Your Top 3 Priority Actions
              </h3>
              {result.topActions.map((act, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-1"
                >
                  <div className="text-xs font-semibold text-teal-800 dark:text-teal-300">
                    0{idx + 1}. {act.title}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {act.whyItMatters}
                  </p>
                  <p className="text-xs font-medium text-slate-900 dark:text-slate-100 pt-1">
                    Step: {act.practicalStep}
                  </p>
                </div>
              ))}
            </div>

            {/* Early Warning Signs & Recommended Screening */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-200 dark:border-slate-800">
              <div>
                <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Early Signs to Be Aware Of</span>
                </h4>
                <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 list-disc pl-4">
                  {result.earlyWarningSigns.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-700" />
                  <span>Suggested Screening Check</span>
                </h4>
                <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 list-disc pl-4">
                  {result.recommendedScreeningTests.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Preliminary Symptom & Red-Flag Literacy Checker */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Symptom & Red-Flag Literacy Check (Educational Only)
          </h2>
          <p className="text-xs text-slate-500">
            Select any symptom you or a family member are experiencing to see what to discuss with a doctor.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {SYMPTOM_EDUCATIONAL_CARDS.map((card) => {
            const active = selectedSymptoms.includes(card.id);
            return (
              <div
                key={card.id}
                onClick={() => toggleSymptom(card.id)}
                className={`p-4 rounded-xl border cursor-pointer transition-colors ${
                  active
                    ? "border-teal-700 bg-teal-50/50 dark:bg-teal-950/30"
                    : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {card.label}
                  </span>
                  <input
                    type="checkbox"
                    checked={active}
                    readOnly
                    className="rounded accent-teal-700 mt-0.5"
                  />
                </div>
                {active && (
                  <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 space-y-1">
                    {card.urgency === "urgent_today" && (
                      <div className="inline-flex items-center gap-1 font-semibold text-red-700 dark:text-red-400">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>Please contact a doctor or urgent care today.</span>
                      </div>
                    )}
                    <p>{card.explanation}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
