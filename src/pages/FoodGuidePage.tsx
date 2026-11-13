import React, { useState, useEffect } from "react";
import {
  Utensils,
  Sparkles,
  CheckCircle2,
  Printer,
  Edit3,
  Save,
  RotateCcw,
  Footprints,
  Film,
} from "lucide-react";
import { Card, StatusBadge, SectionHeader } from "../components/ui/DesignSystem";
import { Report } from "../lib/storage";
import { CallEExplainResponse } from "../lib/extract";

export type SevenDayPlanDay = NonNullable<CallEExplainResponse["sevenDayPlan"]>[number];

interface FoodGuidePageProps {
  latestReport: Report | null;
  profileName: string;
  onUpdateReportPlan: (updatedPlan: SevenDayPlanDay[]) => void;
  onOpenAnimatorStudio: () => void;
}

interface IndianFoodItem {
  id: string;
  category: "grain" | "protein" | "veg" | "dairy" | "beverage" | "snack";
  nameEn: string;
  nameHi: string;
  typicalServing: string;
  glycaemicLoad: "low" | "moderate" | "high";
  sodiumLevel: "low" | "moderate" | "high";
  betterSwapEn: string;
  whySwapHelps: string;
}

const INDIAN_FOOD_CATALOG: IndianFoodItem[] = [
  {
    id: "white_rice",
    category: "grain",
    nameEn: "White Rice (2 katori)",
    nameHi: "सफेद चावल (2 कटोरी)",
    typicalServing: "2 bowls (~300g cooked)",
    glycaemicLoad: "high",
    sodiumLevel: "low",
    betterSwapEn:
      "1 small katori hand-pounded/brown rice + 1 katori extra Moong Dal & Cucumber salad",
    whySwapHelps:
      "Cuts post-meal blood sugar spike (PPBS) by ~25-35 mg/dL by pairing complex fibre and protein before starch.",
  },
  {
    id: "wheat_roti",
    category: "grain",
    nameEn: "3-4 Refined Wheat Rotis",
    nameHi: "3-4 गेहूं की रोटी",
    typicalServing: "3-4 medium phulkas",
    glycaemicLoad: "high",
    sodiumLevel: "low",
    betterSwapEn:
      "2 Multigrain / Jowar-Bajra-Chana Atta Rotis + 1 large bowl Bhindi or Lauki Sabzi",
    whySwapHelps:
      "Adding 30% chana besan or millet flour slows gastric emptying and improves 2-hour post-meal glucose control.",
  },
  {
    id: "yellow_dal",
    category: "protein",
    nameEn: "Thick Toor / Moong Dal Tadka",
    nameHi: "गाढ़ी अरहर / मूंग दाल तड़का",
    typicalServing: "1 large katori (thick consistency)",
    glycaemicLoad: "low",
    sodiumLevel: "low",
    betterSwapEn:
      "Keep thick dal (not watery) + add 50g grilled Paneer, Tofu, Egg Bhurji, or Sprouted Chana",
    whySwapHelps:
      "Most Indian plates are low in protein. Thick dal plus paneer/curd/eggs keeps you full and flattens glucose curves.",
  },
  {
    id: "green_sabzi",
    category: "veg",
    nameEn: "Seasonal Green Sabzi (Palak, Methi, Bhindi, Tinda)",
    nameHi: "मौसमी हरी सब्ज़ी (पालक, मेथी, भिंडी, टिंडा)",
    typicalServing: "1.5 katori (half the plate)",
    glycaemicLoad: "low",
    sodiumLevel: "low",
    betterSwapEn:
      "Eat your fibre & sabzi first before touching roti or rice (Food Sequencing)",
    whySwapHelps:
      "Eating non-starchy vegetables first forms a viscous fibre mesh in the gut that slows sugar absorption.",
  },
  {
    id: "aloo_sabzi",
    category: "veg",
    nameEn: "Aloo Sabzi / Fried Potato Curry",
    nameHi: "आलू की सब्ज़ी",
    typicalServing: "1 katori",
    glycaemicLoad: "high",
    sodiumLevel: "moderate",
    betterSwapEn: "Gobi-Matar, Baingan Bharta, or Methi-Paneer with minimal oil",
    whySwapHelps:
      "Pairing potato sabzi with roti or rice creates a double-carb meal. Swapping potato for cauliflower or greens halves carbohydrate load.",
  },
  {
    id: "curd_raita",
    category: "dairy",
    nameEn: "Homemade Dahi / Cucumber Raita",
    nameHi: "घर का दही / खीरे का रायता",
    typicalServing: "1 katori (unsweetened, roasted jeera)",
    glycaemicLoad: "low",
    sodiumLevel: "low",
    betterSwapEn:
      "Use roasted jeera & mint instead of heavy table salt or sugar in curd",
    whySwapHelps:
      "Probiotics and dairy protein buffer the glycaemic index of the entire meal while keeping sodium low for blood pressure.",
  },
  {
    id: "sweet_chai",
    category: "beverage",
    nameEn: "Milk Chai with 2 tsp Sugar + 2 Biscuits",
    nameHi: "2 चम्मच चीनी वाली चाय + 2 बिस्किट",
    typicalServing: "1 cup + 2 Marie/digestive biscuits",
    glycaemicLoad: "high",
    sodiumLevel: "moderate",
    betterSwapEn:
      "Adrak-Elaichi Chai with 0 sugar + 8 Roasted Almonds/Walnuts or Roasted Makhana",
    whySwapHelps:
      "Eliminating liquid sugar and refined flour biscuits twice a day removes ~140g of pure sugar per week.",
  },
  {
    id: "pickle_papad",
    category: "snack",
    nameEn: "Mango Pickle (Achar) + Fried Papad + Namkeen",
    nameHi: "आम का अचार + पापड़ + नमकीन",
    typicalServing: "1 tbsp pickle + 1 papad",
    glycaemicLoad: "low",
    sodiumLevel: "high",
    betterSwapEn:
      "Fresh Pudina-Dhaniya-Lemon Chutney + Roasted Chana or Cucumber-Carrot sticks",
    whySwapHelps:
      "A single spoon of commercial achar and papad adds ~800mg sodium, directly elevating systolic blood pressure.",
  },
];

const DEFAULT_SEVEN_DAY_PLAN: SevenDayPlanDay[] = [
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
    breakfast: "Steel-cut/rolled oats or vegetable daliya upma with beans, carrots & peanuts",
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
];

export const FoodGuidePage: React.FC<FoodGuidePageProps> = ({
  latestReport,
  profileName,
  onUpdateReportPlan,
  onOpenAnimatorStudio,
}) => {
  const [selectedFoodIds, setSelectedFoodIds] = useState<string[]>([
    "white_rice",
    "yellow_dal",
    "green_sabzi",
    "sweet_chai",
    "pickle_papad",
  ]);
  const [swappedIds, setSwappedIds] = useState<string[]>([]);
  const [editingDayIdx, setEditingDayIdx] = useState<number | null>(null);
  const [planDays, setPlanDays] = useState<SevenDayPlanDay[]>(
    latestReport?.narrative?.sevenDayPlan?.length
      ? latestReport.narrative.sevenDayPlan
      : DEFAULT_SEVEN_DAY_PLAN
  );
  const [draftDay, setDraftDay] = useState<SevenDayPlanDay | null>(null);

  useEffect(() => {
    if (latestReport?.narrative?.sevenDayPlan?.length) {
      setPlanDays(latestReport.narrative.sevenDayPlan);
    }
  }, [latestReport]);

  const toggleFoodItem = (id: string) => {
    setSelectedFoodIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSwap = (id: string) => {
    setSwappedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const selectedFoods = INDIAN_FOOD_CATALOG.filter((f) =>
    selectedFoodIds.includes(f.id)
  );

  const highGlycaemicCount = selectedFoods.filter(
    (f) => f.glycaemicLoad === "high" && !swappedIds.includes(f.id)
  ).length;
  const highSodiumCount = selectedFoods.filter(
    (f) => f.sodiumLevel === "high" && !swappedIds.includes(f.id)
  ).length;
  const hasProtein = selectedFoods.some(
    (f) => f.category === "protein" || f.category === "dairy"
  );
  const hasGreenVeg = selectedFoods.some(
    (f) => f.id === "green_sabzi" || swappedIds.includes("aloo_sabzi")
  );

  const plateBalanceScore = Math.max(
    25,
    Math.min(
      100,
      70 -
        highGlycaemicCount * 15 -
        highSodiumCount * 15 +
        (hasProtein ? 15 : 0) +
        (hasGreenVeg ? 15 : 0) +
        swappedIds.length * 8
    )
  );

  const startEditingDay = (idx: number) => {
    setEditingDayIdx(idx);
    setDraftDay({ ...planDays[idx] });
  };

  const saveEditedDay = () => {
    if (editingDayIdx === null || !draftDay) return;
    const next = [...planDays];
    next[editingDayIdx] = draftDay;
    setPlanDays(next);
    onUpdateReportPlan(next);
    setEditingDayIdx(null);
    setDraftDay(null);
  };

  const resetToDefaultPlan = () => {
    const base = latestReport?.narrative?.sevenDayPlan?.length
      ? latestReport.narrative.sevenDayPlan
      : DEFAULT_SEVEN_DAY_PLAN;
    setPlanDays(base);
    onUpdateReportPlan(base);
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">
            Indian Nutrition & 7-Day Action Plan
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mt-0.5">
            The Milo Indian Plate Builder & Lifestyle Guide
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
            Practical, familiar Indian food swaps for blood sugar and blood pressure — no expensive imported superfoods required.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenAnimatorStudio}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-300 text-xs font-semibold transition-colors"
          >
            <Film className="w-4 h-4 text-teal-600" />
            Animate Plate Photo into Video
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            <Printer className="w-4 h-4" />
            Print 7-Day Plan
          </button>
        </div>
      </div>

      {/* Interactive Indian Thali / Plate Builder */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-4">
          <Card>
            <SectionHeader
              title="1. Build Your Typical Meal or Tea-Time"
              subtitle="Tap the items you usually eat. Then tap 'Apply Better Swap' to see how small kitchen changes flatten sugar and BP spikes."
              icon={<Utensils className="w-5 h-5" />}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {INDIAN_FOOD_CATALOG.map((item) => {
                const isSelected = selectedFoodIds.includes(item.id);
                const isSwapped = swappedIds.includes(item.id);
                return (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isSelected
                        ? isSwapped
                          ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20"
                          : "border-teal-600 bg-teal-50/40 dark:bg-teal-950/20"
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 opacity-75 hover:opacity-100"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => toggleFoodItem(item.id)}
                        className="text-left flex-1"
                      >
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          {item.nameEn}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {item.nameHi} · {item.typicalServing}
                        </div>
                      </button>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleFoodItem(item.id)}
                        aria-label={`Select ${item.nameEn}`}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                      <StatusBadge
                        tone={
                          isSwapped
                            ? "normal"
                            : item.glycaemicLoad === "high"
                              ? "high"
                              : item.glycaemicLoad === "moderate"
                                ? "borderline"
                                : "normal"
                        }
                      >
                        {isSwapped
                          ? "Glycaemic: Optimized"
                          : `Sugar load: ${item.glycaemicLoad}`}
                      </StatusBadge>
                      {item.sodiumLevel === "high" && (
                        <StatusBadge tone={isSwapped ? "normal" : "high"}>
                          {isSwapped ? "Sodium: Reduced" : "High Salt / BP spike"}
                        </StatusBadge>
                      )}
                    </div>

                    {isSelected && (
                      <div className="mt-3 pt-2.5 border-t border-slate-200/70 dark:border-slate-800">
                        <div className="text-[11px] font-semibold text-teal-800 dark:text-teal-300">
                          Smart Swap: {item.betterSwapEn}
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                          {item.whySwapHelps}
                        </p>
                        <button
                          type="button"
                          onClick={() => toggleSwap(item.id)}
                          className={`mt-2 w-full py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                            isSwapped
                              ? "bg-emerald-600 text-white"
                              : "bg-white dark:bg-slate-800 border border-teal-300 dark:border-teal-700 text-teal-700 dark:text-teal-300 hover:bg-teal-50"
                          }`}
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          {isSwapped ? "Better Swap Applied" : "Apply Better Swap"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Visual Thali Balance & Sequencing Feedback */}
        <div className="lg:col-span-5 space-y-4">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Your Thali Balance Score
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Target: ½ Non-starchy Sabzi & Salad · ¼ Thick Dal/Paneer/Egg · ¼ Whole Grain
                </p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-extrabold font-mono tabular-nums text-teal-700 dark:text-teal-400">
                  {plateBalanceScore}/100
                </div>
                <StatusBadge
                  tone={
                    plateBalanceScore >= 80
                      ? "normal"
                      : plateBalanceScore >= 60
                        ? "borderline"
                        : "high"
                  }
                >
                  {plateBalanceScore >= 80
                    ? "Glucose & BP Friendly"
                    : plateBalanceScore >= 60
                      ? "Moderate Spike"
                      : "High Post-Meal Spike"}
                </StatusBadge>
              </div>
            </div>

            {/* Visual Thali Diagram */}
            <div className="relative mx-auto w-56 h-56 rounded-full border-8 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 shadow-inner overflow-hidden grid grid-cols-2 grid-rows-2 gap-1 p-2 my-4">
              <div className="row-span-2 rounded-l-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 flex flex-col items-center justify-center p-2 text-center">
                <span className="text-[11px] font-bold uppercase text-emerald-800 dark:text-emerald-300">
                  50% Fibre & Sabzi
                </span>
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-1">
                  Cucumber, Tomato, Palak, Bhindi, Lauki (Eat First)
                </span>
              </div>
              <div className="rounded-tr-full bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 flex flex-col items-center justify-center p-2 text-center">
                <span className="text-[11px] font-bold uppercase text-amber-900 dark:text-amber-300">
                  25% Protein
                </span>
                <span className="text-[10px] text-amber-800 dark:text-amber-400">
                  Thick Dal, Paneer, Dahi, Chana, Eggs
                </span>
              </div>
              <div className="rounded-br-full bg-sky-100 dark:bg-sky-950/60 border border-sky-300 dark:border-sky-800 flex flex-col items-center justify-center p-2 text-center">
                <span className="text-[11px] font-bold uppercase text-sky-900 dark:text-sky-300">
                  25% Complex Carb
                </span>
                <span className="text-[10px] text-sky-800 dark:text-sky-400">
                  1-2 Multigrain Rotis or 1 small katori Rice
                </span>
              </div>
            </div>

            <div className="space-y-2.5 mt-4">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-900 dark:text-white">
                    The 10-Minute Food Sequencing Rule:
                  </span>{" "}
                  Start every lunch and dinner with 5–6 slices of cucumber/carrot and a few spoons of sabzi & dal before your first bite of roti or rice.
                </div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2.5">
                <Footprints className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-900 dark:text-white">
                    The 15-Minute Post-Meal Walk:
                  </span>{" "}
                  Walking for 15 minutes starting 20 minutes after your heaviest meal lets your leg muscles absorb glucose directly without needing extra insulin.
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Editable & Printable 7-Day Lifestyle Plan */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              2. Editable 7-Day Indian Lifestyle Plan for {profileName}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {latestReport?.narrative?.sevenDayPlan?.length
                ? `Tailored from your ${latestReport.labName} report (${latestReport.date}). Click Edit on any day to customize for your household kitchen.`
                : "Standard Indian metabolic & blood pressure friendly 7-day template. Click Edit on any day to customize."}
            </p>
          </div>
          <button
            type="button"
            onClick={resetToDefaultPlan}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Plan
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {planDays.map((dayPlan, idx) => {
            const isEditing = editingDayIdx === idx && draftDay !== null;
            return (
              <div
                key={dayPlan.day}
                className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5 mb-3">
                    <span className="text-sm font-bold text-teal-800 dark:text-teal-300">
                      {dayPlan.day}
                    </span>
                    {!isEditing ? (
                      <button
                        type="button"
                        onClick={() => startEditingDay(idx)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-teal-700 dark:hover:text-teal-300"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Edit
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={saveEditedDay}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-teal-600 text-white text-xs font-semibold"
                      >
                        <Save className="w-3.5 h-3.5" />
                        Save
                      </button>
                    )}
                  </div>

                  {isEditing && draftDay ? (
                    <div className="space-y-2 text-xs">
                      {(
                        [
                          "breakfast",
                          "lunch",
                          "eveningSnack",
                          "dinner",
                          "movementAndSleep",
                        ] as const
                      ).map((field) => (
                        <div key={field}>
                          <label className="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">
                            {field.replace(/([A-Z])/g, " $1")}
                          </label>
                          <textarea
                            rows={2}
                            value={draftDay[field]}
                            onChange={(e) =>
                              setDraftDay({ ...draftDay, [field]: e.target.value })
                            }
                            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs text-slate-900 dark:text-white"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2.5 text-xs">
                      <div>
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          Breakfast:{" "}
                        </span>
                        <span className="text-slate-600 dark:text-slate-400">
                          {dayPlan.breakfast}
                        </span>
                      </div>
                      <div>
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          Lunch:{" "}
                        </span>
                        <span className="text-slate-600 dark:text-slate-400">
                          {dayPlan.lunch}
                        </span>
                      </div>
                      <div>
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          4 PM Chai/Snack:{" "}
                        </span>
                        <span className="text-slate-600 dark:text-slate-400">
                          {dayPlan.eveningSnack}
                        </span>
                      </div>
                      <div>
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          Dinner:{" "}
                        </span>
                        <span className="text-slate-600 dark:text-slate-400">
                          {dayPlan.dinner}
                        </span>
                      </div>
                      <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800 flex items-start gap-1.5 text-teal-800 dark:text-teal-300">
                        <Footprints className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span>{dayPlan.movementAndSleep}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};
