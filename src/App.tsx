import React, { useState, useEffect, useMemo } from "react";
import {
  Activity,
  FilePlus2,
  ClipboardCheck,
  Utensils,
  History,
  MessageSquareHeart,
  Users,
  Sun,
  Moon,
  Type,
  Globe,
  ShieldCheck,
  HeartPulse,
  MapPin,
  Film,
  FileSpreadsheet,
} from "lucide-react";
import { getTranslations, SupportedLanguage } from "./lib/i18n";
import {
  AppStateData,
  AppointmentReminder,
  loadAppState,
  Medicine,
  Reading,
  Report,
  saveAppState,
} from "./lib/storage";
import { DocumentType, SampleReportPreset } from "./lib/extract";
import { normalizeExtractedTests, NormalizedTestValue } from "./lib/normalize";
import {
  DEFAULT_TREND_ALERT_CONFIG,
  runDeterministicEngine,
  TrendAlertRuleConfig,
} from "./lib/engine";
import { callEExplainReport } from "./lib/gemini";
import { WelcomePage } from "./pages/WelcomePage";
import { AddReportAndReviewPage } from "./pages/AddReportAndReviewPage";
import { ResultsPage } from "./pages/ResultsPage";
import { PreventionCheckPage } from "./pages/PreventionCheckPage";
import { DailyLogAndMedicinesPage } from "./pages/DailyLogAndMedicinesPage";
import { FoodGuidePage, SevenDayPlanDay } from "./pages/FoodGuidePage";
import { HistoryComparePage } from "./pages/HistoryComparePage";
import { AskMiloPage } from "./pages/AskMiloPage";
import { ConsentModal } from "./components/ConsentModal";
import { ProfileManagerModal } from "./components/ProfileManagerModal";
import { CareMapsAgent } from "./components/CareMapsAgent";
import { VideoAnimatorStudio } from "./components/VideoAnimatorStudio";
import { DrawerModal } from "./components/ui/DesignSystem";

export type ScreenId =
  | "welcome"
  | "add_report"
  | "results"
  | "prevention"
  | "daily_log"
  | "food_guide"
  | "history"
  | "ask_milo";

export default function App() {
  const [appState, setAppState] = useState<AppStateData>(() => loadAppState());
  const [activeScreen, setActiveScreen] = useState<ScreenId>("welcome");
  const [uploadInitialMode, setUploadInitialMode] = useState<
    "upload" | "scan" | "manual"
  >("upload");
  const [uploadPreset, setUploadPreset] = useState<SampleReportPreset | null>(
    null
  );
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [isRegeneratingNarrative, setIsRegeneratingNarrative] = useState(false);

  // Modals & Drawers
  const [consentOpen, setConsentOpen] = useState(false);
  const [pendingConsentCallback, setPendingConsentCallback] = useState<
    (() => void) | null
  >(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [mapsDrawerOpen, setMapsDrawerOpen] = useState(false);
  const [animatorDrawerOpen, setAnimatorDrawerOpen] = useState(false);

  // Google Maps Demo Key Quota Exceeded state
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  useEffect(() => {
    const handler = () => setQuotaExceeded(true);
    window.addEventListener("gmp-quota-exceeded", handler);
    return () => window.removeEventListener("gmp-quota-exceeded", handler);
  }, []);

  // Persist state on every update
  useEffect(() => {
    saveAppState(appState);
  }, [appState]);

  // Apply dark mode and large-text classes to document root
  useEffect(() => {
    const html = document.documentElement;
    if (appState.settings.darkMode) {
      html.classList.add("dark");
    } else {
      html.classList.remove("dark");
    }
    if (appState.settings.largeText) {
      html.style.fontSize = "112.5%"; // 18px base
    } else {
      html.style.fontSize = "100%"; // 16px base
    }
  }, [appState.settings.darkMode, appState.settings.largeText]);

  const dict = useMemo(
    () => getTranslations(appState.settings.language),
    [appState.settings.language]
  );

  const activeProfile = useMemo(() => {
    return (
      appState.profiles.find((p) => p.id === appState.activeProfileId) ||
      appState.profiles[0]
    );
  }, [appState.profiles, appState.activeProfileId]);

  const profileReports = useMemo(() => {
    return appState.reports
      .filter((r) => r.profileId === activeProfile.id)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [appState.reports, activeProfile.id]);

  const activeReport: Report | null = useMemo(() => {
    if (selectedReportId) {
      const found = profileReports.find((r) => r.id === selectedReportId);
      if (found) return found;
    }
    return profileReports[0] || null;
  }, [profileReports, selectedReportId]);

  const profileReadings = useMemo(
    () => appState.readings.filter((r) => r.profileId === activeProfile.id),
    [appState.readings, activeProfile.id]
  );

  const profileMedicines = useMemo(
    () => appState.medicines.filter((m) => m.profileId === activeProfile.id),
    [appState.medicines, activeProfile.id]
  );

  const profileAppointments = useMemo(
    () => appState.appointments.filter((a) => a.profileId === activeProfile.id),
    [appState.appointments, activeProfile.id]
  );

  const updateSettings = (patch: Partial<AppStateData["settings"]>) => {
    setAppState((prev) => ({
      ...prev,
      settings: { ...prev.settings, ...patch },
    }));
  };

  const handleRequireConsent = (onAccepted: () => void) => {
    if (appState.settings.consentAccepted) {
      onAccepted();
      return;
    }
    setPendingConsentCallback(() => onAccepted);
    setConsentOpen(true);
  };

  const handleAcceptConsent = () => {
    updateSettings({
      consentAccepted: true,
      consentDate: new Date().toISOString(),
    });
    setConsentOpen(false);
    if (pendingConsentCallback) {
      pendingConsentCallback();
      setPendingConsentCallback(null);
    }
  };

  const handleCompleteReportReview = async (payload: {
    reportDate: string;
    labName: string;
    documentType: DocumentType;
    isSample: boolean;
    pathologyTerms: { term: string; contextAsPrinted: string }[];
    confirmedValues: NormalizedTestValue[];
  }) => {
    const engineOutput = runDeterministicEngine(
      payload.confirmedValues,
      {
        age: activeProfile.age,
        sex: activeProfile.sex,
        heightCm: activeProfile.heightCm,
        weightKg: activeProfile.weightKg,
        waistCm: activeProfile.waistCm,
        conditions: activeProfile.conditions,
        tobaccoUse: activeProfile.tobaccoUse,
        diabetesDurationYears: activeProfile.diabetesDurationYears,
      },
      payload.documentType
    );

    let narrative = null;
    try {
      narrative = await callEExplainReport({
        confirmedValues: payload.confirmedValues,
        engineOutput,
        pathologyTerms: payload.pathologyTerms,
        language: appState.settings.language,
        cache: appState.explainCache,
        onCacheSave: (key, val) => {
          setAppState((prev) => ({
            ...prev,
            explainCache: { ...prev.explainCache, [key]: val },
          }));
        },
      });
    } catch {
      // Fallback plain-language narrative derived strictly from deterministic findings if AI call fails
      narrative = {
        summary: `Confirmed ${payload.confirmedValues.length} clinical biomarkers from ${payload.labName} (${payload.reportDate}). ${
          engineOutput.hasUrgentValues
            ? engineOutput.urgentBannerMessage
            : "Review the individual test rows and organ breakdown tabs below with your physician."
        }`,
        whyItHappens:
          "Metabolic markers such as blood glucose, blood pressure, lipids, and kidney filtration interact closely across your blood vessels. Regular post-meal movement, balanced Indian plate proportions, adequate sleep, and doctor-guided care help keep these numbers in range.",
        organNotes: {
          eyes:
            engineOutput.horizons?.years5.organs.eyes.topDrivers[0] ||
            "Maintain steady blood sugar and blood pressure to protect retinal capillaries.",
          kidneys:
            engineOutput.horizons?.years5.organs.kidneys.topDrivers[0] ||
            "Keep blood pressure and hydration steady to support glomerular filtration.",
          nerves:
            engineOutput.horizons?.years5.organs.nerves.topDrivers[0] ||
            "Consistent glucose control and Vitamin B12 adequacy protect peripheral nerves.",
          heart:
            engineOutput.horizons?.years5.organs.heart.topDrivers[0] ||
            "Controlling LDL cholesterol, blood pressure, and waist circumference supports cardiovascular health.",
        },
        roadmap: [
          {
            timeframe: "Next 7 days",
            title: "Start a 15-minute brisk walk after lunch and dinner",
            detail:
              "Walking 20 minutes after meals improves post-meal glucose uptake.",
          },
          {
            timeframe: "Next 4 weeks",
            title: "Follow the Milo ¼ Grain · ¼ Protein · ½ Sabzi Plate",
            detail:
              "Prioritize non-starchy vegetables and thick dal while cutting added salt and pickles.",
          },
          {
            timeframe: "Next 12 weeks",
            title: "Review report with your doctor",
            detail:
              "Bring your printed Milo summary and questions to your next clinic appointment.",
          },
        ],
        doctorQuestions: [
          "What target values should we aim for over the next 3 months based on this report?",
          "When should I schedule my next follow-up blood or urine check?",
          "Which daily lifestyle adjustments will make the biggest difference for my numbers?",
        ],
        glossaryTerms: engineOutput.findings.slice(0, 4).map((f) => ({
          term: f.displayName,
          plainMeaning: f.plainSummary,
        })),
      };
    }

    const newReport: Report = {
      id: `report-${Date.now()}`,
      profileId: activeProfile.id,
      date: payload.reportDate,
      labName: payload.labName,
      type: payload.documentType,
      isSample: payload.isSample,
      pathologyTerms: payload.pathologyTerms,
      values: payload.confirmedValues,
      engineOutput,
      narrative,
      createdAt: new Date().toISOString(),
    };

    setAppState((prev) => ({
      ...prev,
      reports: [newReport, ...prev.reports],
    }));
    setSelectedReportId(newReport.id);
    setActiveScreen("results");
  };

  const handleRegenerateNarrative = async () => {
    if (!activeReport) return;
    setIsRegeneratingNarrative(true);
    try {
      const freshNarrative = await callEExplainReport({
        confirmedValues: activeReport.values,
        engineOutput: activeReport.engineOutput,
        pathologyTerms: activeReport.pathologyTerms,
        language: appState.settings.language,
        cache: {},
        onCacheSave: (key, val) => {
          setAppState((prev) => ({
            ...prev,
            explainCache: { ...prev.explainCache, [key]: val },
          }));
        },
      });
      setAppState((prev) => ({
        ...prev,
        reports: prev.reports.map((r) =>
          r.id === activeReport.id ? { ...r, narrative: freshNarrative } : r
        ),
      }));
    } catch {
      // Keep existing or deterministic narrative if offline
    } finally {
      setIsRegeneratingNarrative(false);
    }
  };

  const handleAddReadings = (items: Omit<Reading, "id">[]) => {
    const created: Reading[] = items.map((item, idx) => ({
      ...item,
      id: `reading-${Date.now()}-${idx}`,
    }));
    setAppState((prev) => ({
      ...prev,
      readings: [...created, ...prev.readings],
    }));
  };

  const handleAddMedicine = (med: Omit<Medicine, "id" | "adherenceLog">) => {
    const newMed: Medicine = {
      ...med,
      id: `med-${Date.now()}`,
      adherenceLog: {},
    };
    setAppState((prev) => ({
      ...prev,
      medicines: [...prev.medicines, newMed],
    }));
  };

  const handleToggleMedicineTaken = (medId: string, dateTimeKey: string) => {
    setAppState((prev) => ({
      ...prev,
      medicines: prev.medicines.map((m) => {
        if (m.id !== medId) return m;
        const current = Boolean(m.adherenceLog[dateTimeKey]);
        return {
          ...m,
          adherenceLog: {
            ...m.adherenceLog,
            [dateTimeKey]: !current,
          },
        };
      }),
    }));
  };

  const handleDeleteMedicine = (medId: string) => {
    setAppState((prev) => ({
      ...prev,
      medicines: prev.medicines.filter((m) => m.id !== medId),
    }));
  };

  const handleAddAppointment = (appt: Omit<AppointmentReminder, "id">) => {
    const newAppt: AppointmentReminder = {
      ...appt,
      id: `appt-${Date.now()}`,
    };
    setAppState((prev) => ({
      ...prev,
      appointments: [...prev.appointments, newAppt],
    }));
  };

  const handleUpdateReportPlan = (updatedPlan: SevenDayPlanDay[]) => {
    if (!activeReport || !activeReport.narrative) return;
    setAppState((prev) => ({
      ...prev,
      reports: prev.reports.map((r) =>
        r.id === activeReport.id && r.narrative
          ? {
              ...r,
              narrative: {
                ...r.narrative,
                sevenDayPlan: updatedPlan,
              },
            }
          : r
      ),
    }));
  };

  const handleDeleteReport = (reportId: string) => {
    setAppState((prev) => ({
      ...prev,
      reports: prev.reports.filter((r) => r.id !== reportId),
    }));
    if (selectedReportId === reportId) {
      setSelectedReportId(null);
    }
  };

  const handleUpdateTrendAlertConfig = (nextCfg: TrendAlertRuleConfig) => {
    updateSettings({ trendAlertConfig: nextCfg });
  };

  const handleSimulateReportTrend = () => {
    const sorted = [...profileReports].sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    const latest = sorted[sorted.length - 1];
    const prevHba1c =
      latest?.values.find((v) => v.canonicalName === "hba1c")?.value ?? 7.4;
    const prevSbp =
      latest?.values.find((v) => v.canonicalName === "systolic_bp")?.value ??
      136;
    const prevFbs =
      latest?.values.find((v) => v.canonicalName === "fasting_glucose")
        ?.value ?? 142;

    const buildSyntheticReport = (
      dateStr: string,
      labLabel: string,
      hba1cVal: number,
      sbpVal: number,
      fbsVal: number,
      offsetMs: number
    ): Report => {
      const vals = normalizeExtractedTests([
        {
          canonicalName: "hba1c",
          nameAsPrinted: "HbA1c (HPLC)",
          value: Number(hba1cVal.toFixed(1)),
          unit: "%",
          refLow: 4.0,
          refHigh: 5.6,
          confidence: 0.99,
          page: 1,
        },
        {
          canonicalName: "systolic_bp",
          nameAsPrinted: "Seated Systolic BP",
          value: Math.round(sbpVal),
          unit: "mmHg",
          refLow: 90,
          refHigh: 119,
          confidence: 0.99,
          page: 1,
        },
        {
          canonicalName: "diastolic_bp",
          nameAsPrinted: "Seated Diastolic BP",
          value: 88,
          unit: "mmHg",
          refLow: 60,
          refHigh: 79,
          confidence: 0.99,
          page: 1,
        },
        {
          canonicalName: "fasting_glucose",
          nameAsPrinted: "Fasting Blood Sugar (FBS)",
          value: Math.round(fbsVal),
          unit: "mg/dL",
          refLow: 70,
          refHigh: 99,
          confidence: 0.99,
          page: 1,
        },
      ]);
      const eng = runDeterministicEngine(
        vals,
        {
          age: activeProfile.age,
          sex: activeProfile.sex,
          heightCm: activeProfile.heightCm,
          weightKg: activeProfile.weightKg,
          waistCm: activeProfile.waistCm,
          conditions: activeProfile.conditions,
        },
        "blood"
      );
      return {
        id: `report-trend-sim-${Date.now()}-${offsetMs}`,
        profileId: activeProfile.id,
        date: dateStr,
        labName: labLabel,
        type: "blood",
        isSample: true,
        values: vals,
        engineOutput: eng,
        narrative: latest?.narrative || null,
        createdAt: new Date(Date.now() + offsetMs).toISOString(),
      };
    };

    if (sorted.length < 2) {
      const r1 = buildSyntheticReport(
        "2026-05-10",
        "Sample — Trend Entry #1",
        6.9,
        130,
        128,
        1
      );
      const r2 = buildSyntheticReport(
        "2026-08-10",
        "Sample — Trend Entry #2",
        7.3,
        136,
        138,
        2
      );
      const r3 = buildSyntheticReport(
        "2026-11-11",
        "Sample — Trend Entry #3 (Upward Alert)",
        7.8,
        144,
        152,
        3
      );
      setAppState((prev) => ({
        ...prev,
        reports: [r3, r2, r1, ...prev.reports],
      }));
      setSelectedReportId(r3.id);
    } else {
      const nextDate = new Date().toISOString().slice(0, 10);
      const rNext = buildSyntheticReport(
        nextDate,
        "Sample — Follow-Up Check (3-Entry Upward Trend)",
        prevHba1c + 0.4,
        prevSbp + 6,
        prevFbs + 12,
        10
      );
      setAppState((prev) => ({
        ...prev,
        reports: [rNext, ...prev.reports],
      }));
      setSelectedReportId(rNext.id);
    }
  };

  const handleSimulateLogTrend = () => {
    const now = Date.now();
    const bpSorted = profileReadings
      .filter((r) => r.kind === "bp")
      .sort((a, b) => a.time.localeCompare(b.time));
    const gluSorted = profileReadings
      .filter((r) => r.kind === "glucose")
      .sort((a, b) => a.time.localeCompare(b.time));

    const lastSys = bpSorted[bpSorted.length - 1]?.value ?? 132;
    const lastDia = bpSorted[bpSorted.length - 1]?.secondaryValue ?? 84;
    const lastGlu = gluSorted[gluSorted.length - 1]?.value ?? 126;

    const simulatedEntries: Omit<Reading, "id">[] = [
      {
        profileId: activeProfile.id,
        kind: "bp",
        value: lastSys + 3,
        secondaryValue: lastDia + 2,
        pulseValue: 75,
        context: "morning",
        time: new Date(now - 120_000).toISOString(),
        source: "manual",
      },
      {
        profileId: activeProfile.id,
        kind: "bp",
        value: lastSys + 7,
        secondaryValue: lastDia + 5,
        pulseValue: 78,
        context: "evening",
        time: new Date(now - 60_000).toISOString(),
        source: "manual",
      },
      {
        profileId: activeProfile.id,
        kind: "glucose",
        value: lastGlu + 8,
        context: "fasting",
        time: new Date(now - 90_000).toISOString(),
        source: "manual",
      },
      {
        profileId: activeProfile.id,
        kind: "glucose",
        value: lastGlu + 18,
        context: "fasting",
        time: new Date(now - 30_000).toISOString(),
        source: "manual",
      },
    ];

    handleAddReadings(simulatedEntries);
  };

  const navItems: {
    id: ScreenId;
    label: string;
    Icon: React.ComponentType<any>;
  }[] = [
    { id: "welcome", label: dict.nav.home, Icon: HeartPulse },
    { id: "add_report", label: dict.nav.addReport, Icon: FilePlus2 },
    { id: "results", label: dict.nav.results, Icon: FileSpreadsheet },
    { id: "prevention", label: dict.nav.prevention, Icon: ClipboardCheck },
    { id: "daily_log", label: dict.nav.dailyLog, Icon: Activity },
    { id: "food_guide", label: dict.nav.foodGuide, Icon: Utensils },
    { id: "history", label: dict.nav.history, Icon: History },
    { id: "ask_milo", label: dict.nav.askMilo, Icon: MessageSquareHeart },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#FBFBF9] dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Google Maps Demo Key Tier 1 Quota Notice Banner */}
      {quotaExceeded && (
        <div
          role="alert"
          style={{
            position: "sticky",
            top: 0,
            zIndex: 9999,
            backgroundColor: "#fffbeb",
            borderBottom: "1px solid #f59e0b",
            color: "#92400e",
            padding: "12px 16px",
            fontSize: "14px",
            lineHeight: "1.5",
          }}
        >
          <strong>Google Maps quota reached.</strong> The free demo key has
          exceeded its usage limit. Note that the quota limit is shared across
          all apps using the demo key. You can wait a few minutes and try again,
          or to continue uninterrupted, ask the agent to switch to your own
          Google Cloud API key, or set up your key in the{" "}
          <a
            href="https://console.cloud.google.com/google/maps-apis/quotas"
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: "underline", fontWeight: 600 }}
          >
            Google Cloud Console
          </a>
          .
        </div>
      )}

      {/* Top Bar Contract: Single sticky header with navigation + utility controls */}
      <header className="sticky top-0 z-40 border-b border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs print:hidden">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-3">
            {/* Brand Identity */}
            <button
              type="button"
              onClick={() => setActiveScreen("welcome")}
              className="flex items-center gap-2.5 text-left shrink-0 group"
            >
              <div className="w-9 h-9 rounded-xl bg-teal-700 text-white flex items-center justify-center font-display font-bold text-lg shadow-xs group-hover:bg-teal-800 transition-colors">
                M
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-display font-bold text-base tracking-tight text-slate-900 dark:text-white">
                    {dict.appName}
                  </span>
                  <span className="text-[11px] font-medium text-teal-700 dark:text-teal-400">
                    · {dict.tagline}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
                  {dict.heroSubtitle}
                </p>
              </div>
            </button>

            {/* Quick Action & Utility Bar */}
            <div className="flex items-center gap-2 overflow-x-auto">
              {/* Care Maps Quick Drawer Trigger */}
              <button
                type="button"
                onClick={() => setMapsDrawerOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
                title="Find Nearby Labs, Hospitals & Walking Routes"
              >
                <MapPin className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                <span className="hidden md:inline">Nearby Care & Maps</span>
              </button>

              {/* Omni Flash Video Studio Trigger */}
              <button
                type="button"
                onClick={() => setAnimatorDrawerOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
                title="Animate Photos into Video with Gemini Omni Flash"
              >
                <Film className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                <span className="hidden md:inline">Video Animator</span>
              </button>

              {/* Family Profile Switcher */}
              <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 shrink-0">
                <Users className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400 mr-1.5" />
                <select
                  aria-label="Active family profile"
                  value={activeProfile.id}
                  onChange={(e) => {
                    setAppState((prev) => ({
                      ...prev,
                      activeProfileId: e.target.value,
                    }));
                    setSelectedReportId(null);
                  }}
                  className="bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none pr-1"
                >
                  {appState.profiles.map((p) => (
                    <option
                      key={p.id}
                      value={p.id}
                      className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    >
                      {p.customName} ({p.label})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setProfileModalOpen(true)}
                  className="ml-1.5 pl-1.5 border-l border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-teal-700 dark:text-teal-300 hover:underline whitespace-nowrap"
                >
                  Manage
                </button>
              </div>

              {/* Language Switcher (English / हिन्दी) */}
              <button
                type="button"
                onClick={() => {
                  const nextLang: SupportedLanguage =
                    appState.settings.language === "en" ? "hi" : "en";
                  updateSettings({ language: nextLang });
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
                title="Switch Language (English / Hindi)"
              >
                <Globe className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                <span>
                  {appState.settings.language === "en" ? "हिन्दी" : "EN"}
                </span>
              </button>

              {/* Large Text Accessibility Toggle */}
              <button
                type="button"
                onClick={() =>
                  updateSettings({ largeText: !appState.settings.largeText })
                }
                aria-pressed={appState.settings.largeText}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                  appState.settings.largeText
                    ? "bg-teal-700 text-white border-teal-700"
                    : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
                title="Toggle Large Text Mode for Senior Readability"
              >
                <Type className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">{dict.common.largeText}</span>
              </button>

              {/* Theme Toggle (Bright Default + Dark Mode) */}
              <button
                type="button"
                onClick={() =>
                  updateSettings({ darkMode: !appState.settings.darkMode })
                }
                aria-label="Toggle color theme"
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
              >
                {appState.settings.darkMode ? (
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <Moon className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Primary Screen Navigation Tabs */}
          <nav
            aria-label="Main navigation"
            className="flex items-center gap-1 py-2 border-t border-slate-100 dark:border-slate-800/80 overflow-x-auto"
          >
            {navItems.map((item) => {
              const Icon = item.Icon;
              const isActive = activeScreen === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (item.id === "add_report") {
                      setUploadPreset(null);
                      setUploadInitialMode("upload");
                    }
                    setActiveScreen(item.id);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? "bg-teal-700 text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-16">
        {activeScreen === "welcome" && (
          <WelcomePage
            dict={dict}
            language={appState.settings.language}
            activeProfile={activeProfile}
            latestReport={activeReport}
            onStartUpload={(mode = "upload") => {
              setUploadPreset(null);
              setUploadInitialMode(mode);
              setActiveScreen("add_report");
            }}
            onOpenPrevention={() => setActiveScreen("prevention")}
            onLoadSamplePreset={(preset) => {
              setUploadPreset(preset);
              setUploadInitialMode("upload");
              setActiveScreen("add_report");
            }}
            onOpenResults={() => setActiveScreen("results")}
            onOpenDailyLog={() => setActiveScreen("daily_log")}
          />
        )}

        {activeScreen === "add_report" && (
          <AddReportAndReviewPage
            key={`${uploadInitialMode}-${uploadPreset?.id || "custom"}`}
            dict={dict}
            initialMode={uploadInitialMode}
            initialPreset={uploadPreset}
            consentAccepted={appState.settings.consentAccepted}
            onRequireConsent={handleRequireConsent}
            onCompleteReview={handleCompleteReportReview}
          />
        )}

        {activeScreen === "results" && (
          <ResultsPage
            dict={dict}
            report={activeReport}
            allProfileReports={profileReports}
            profile={activeProfile}
            trendAlertConfig={
              appState.settings.trendAlertConfig || DEFAULT_TREND_ALERT_CONFIG
            }
            onUpdateTrendAlertConfig={handleUpdateTrendAlertConfig}
            onSimulateReportTrend={handleSimulateReportTrend}
            onAddNewReport={() => {
              setUploadPreset(null);
              setUploadInitialMode("upload");
              setActiveScreen("add_report");
            }}
            onRegenerateNarrative={handleRegenerateNarrative}
            isRegeneratingNarrative={isRegeneratingNarrative}
            onOpenMapsCare={() => setMapsDrawerOpen(true)}
          />
        )}

        {activeScreen === "prevention" && (
          <PreventionCheckPage profile={activeProfile} />
        )}

        {activeScreen === "daily_log" && (
          <DailyLogAndMedicinesPage
            profile={activeProfile}
            readings={profileReadings}
            medicines={profileMedicines}
            appointments={profileAppointments}
            notificationsEnabled={appState.settings.notificationsEnabled}
            trendAlertConfig={
              appState.settings.trendAlertConfig || DEFAULT_TREND_ALERT_CONFIG
            }
            onUpdateTrendAlertConfig={handleUpdateTrendAlertConfig}
            onSimulateLogTrend={handleSimulateLogTrend}
            onAddReadings={handleAddReadings}
            onAddMedicine={handleAddMedicine}
            onToggleMedicineTaken={handleToggleMedicineTaken}
            onDeleteMedicine={handleDeleteMedicine}
            onAddAppointment={handleAddAppointment}
            onEnableNotifications={(granted) =>
              updateSettings({ notificationsEnabled: granted })
            }
          />
        )}

        {activeScreen === "food_guide" && (
          <FoodGuidePage
            latestReport={activeReport}
            profileName={activeProfile.customName}
            onUpdateReportPlan={handleUpdateReportPlan}
            onOpenAnimatorStudio={() => setAnimatorDrawerOpen(true)}
          />
        )}

        {activeScreen === "history" && (
          <HistoryComparePage
            reports={profileReports}
            activeReportId={activeReport?.id || null}
            onSelectReport={(id) => {
              setSelectedReportId(id);
              setActiveScreen("results");
            }}
            onDeleteReport={handleDeleteReport}
            onAddNewReport={() => {
              setUploadPreset(null);
              setUploadInitialMode("upload");
              setActiveScreen("add_report");
            }}
          />
        )}

        {activeScreen === "ask_milo" && (
          <AskMiloPage
            latestReport={activeReport}
            language={appState.settings.language}
            profileName={activeProfile.customName}
          />
        )}
      </main>

      {/* Persistent Safety & Privacy Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-5 px-4 sm:px-6 lg:px-8 text-xs text-slate-500 dark:text-slate-400 print:hidden">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" />
            <span>{dict.consent.point1}</span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setProfileModalOpen(true)}
              className="text-teal-700 dark:text-teal-400 font-semibold hover:underline"
            >
              Encrypted Family Vault & Privacy Settings
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <ConsentModal
        open={consentOpen}
        dict={dict}
        onAccept={handleAcceptConsent}
        onCancel={() => {
          setConsentOpen(false);
          setPendingConsentCallback(null);
        }}
      />

      <ProfileManagerModal
        open={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        appState={appState}
        onUpdateState={(updater) => setAppState((prev) => updater(prev))}
      />

      <DrawerModal
        open={mapsDrawerOpen}
        onClose={() => setMapsDrawerOpen(false)}
        title="Milo Care Locator — Real-Time Google Maps & Grounded Places Agent"
      >
        <CareMapsAgent language={appState.settings.language} />
      </DrawerModal>

      <DrawerModal
        open={animatorDrawerOpen}
        onClose={() => setAnimatorDrawerOpen(false)}
        title="Gemini Omni Flash — Animate Product, Plate or Character Photo into Video"
      >
        <VideoAnimatorStudio />
      </DrawerModal>
    </div>
  );
}
