import React, { useMemo, useState } from "react";
import {
  BookOpen,
  Calculator,
  CheckCircle2,
  Eye,
  FileDown,
  FilePlus2,
  HelpCircle,
  Printer,
  RefreshCw,
  Share2,
  Sliders,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  DrawerModal,
  SegmentedTabs,
  StatusIndicator,
  UrgentSafetyBanner,
} from "../components/ui/DesignSystem";
import { TrendAlertCenter } from "../components/TrendAlertCenter";
import { THRESHOLDS } from "../config/thresholds";
import { TranslationDict } from "../i18n/en";
import {
  DEFAULT_TREND_ALERT_CONFIG,
  detectReportUpwardTrends,
  OrganKey,
  runLifestyleSimulator,
  SimulatorInput,
  TrendAlertRuleConfig,
} from "../lib/engine";
import { buildDoctorShareSummary, shareOrCopySummary } from "../lib/share";
import { Profile, Report } from "../lib/storage";

type ResultTabId =
  | "summary"
  | "why"
  | "organs"
  | "trajectory"
  | "improve"
  | "questions";

export function ResultsPage({
  dict,
  report,
  allProfileReports = [],
  profile,
  trendAlertConfig = DEFAULT_TREND_ALERT_CONFIG,
  onUpdateTrendAlertConfig,
  onSimulateReportTrend,
  onAddNewReport,
  onRegenerateNarrative,
  isRegeneratingNarrative,
  onOpenMapsCare,
}: {
  dict: TranslationDict;
  report: Report | null;
  allProfileReports?: Report[];
  profile: Profile;
  trendAlertConfig?: TrendAlertRuleConfig;
  onUpdateTrendAlertConfig?: (cfg: TrendAlertRuleConfig) => void;
  onSimulateReportTrend?: () => void;
  onAddNewReport: () => void;
  onRegenerateNarrative: () => Promise<void>;
  isRegeneratingNarrative: boolean;
  onOpenMapsCare: () => void;
}) {
  const [activeTab, setActiveTab] = useState<ResultTabId>("summary");
  const [horizonYears, setHorizonYears] = useState<2 | 5 | 10>(5);
  const [calcDrawerOpen, setCalcDrawerOpen] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [printPreviewMode, setPrintPreviewMode] = useState(false);
  const [selectedLongitudinalMetric, setSelectedLongitudinalMetric] =
    useState<string>("hba1c");
  const [longitudinalChartStyle, setLongitudinalChartStyle] = useState<
    "line" | "bar"
  >("line");

  // Interactive Before & After Simulator state
  const [simInput, setSimInput] = useState<SimulatorInput>({
    weightLossPercent: 4,
    walkingMinutesAfterMeals: 20,
    saltReduction: 1,
    sleepHours: 7.5,
    tobaccoCessation: Boolean(profile.tobaccoUse),
    medicineAdherence: true,
  });

  const chronologicalReports = useMemo(() => {
    const baseList =
      allProfileReports.length > 0
        ? allProfileReports
        : report
          ? [report]
          : [];
    return [...baseList].sort((a, b) => {
      const cmp = a.date.localeCompare(b.date);
      if (cmp !== 0) return cmp;
      return (a.createdAt || "").localeCompare(b.createdAt || "");
    });
  }, [allProfileReports, report]);

  const longitudinalMetricsCatalog = useMemo(() => {
    const metaByCanonical: Record<
      string,
      {
        canonicalName: string;
        displayName: string;
        unit: string;
        higherIsBetter: boolean;
        targetLabel: string;
        normalLine?: { value: number; label: string; color: string };
        cautionLine?: { value: number; label: string; color: string };
        domainMin?: number;
      }
    > = {
      hba1c: {
        canonicalName: "hba1c",
        displayName: "HbA1c (3-Month Avg Sugar)",
        unit: "%",
        higherIsBetter: false,
        targetLabel: "Normal < 5.7% · Prediabetes 5.7–6.4% · Diabetes ≥ 6.5%",
        normalLine: { value: 5.7, label: "Normal <5.7%", color: "#0D9488" },
        cautionLine: { value: 6.5, label: "Diabetes ≥6.5%", color: "#DC2626" },
        domainMin: 4.5,
      },
      systolic_bp: {
        canonicalName: "systolic_bp",
        displayName: "Systolic Blood Pressure",
        unit: "mmHg",
        higherIsBetter: false,
        targetLabel: "Normal < 120 mmHg · Stage 1: 130–139 · Stage 2: ≥ 140 mmHg",
        normalLine: { value: 120, label: "Normal 120", color: "#0D9488" },
        cautionLine: { value: 140, label: "Stage 2 ≥140", color: "#DC2626" },
        domainMin: 90,
      },
      diastolic_bp: {
        canonicalName: "diastolic_bp",
        displayName: "Diastolic Blood Pressure",
        unit: "mmHg",
        higherIsBetter: false,
        targetLabel: "Normal < 80 mmHg · Stage 1: 80–89 · Stage 2: ≥ 90 mmHg",
        normalLine: { value: 80, label: "Normal 80", color: "#0D9488" },
        cautionLine: { value: 90, label: "Stage 2 ≥90", color: "#DC2626" },
        domainMin: 55,
      },
      fasting_glucose: {
        canonicalName: "fasting_glucose",
        displayName: "Fasting Blood Sugar (FBS)",
        unit: "mg/dL",
        higherIsBetter: false,
        targetLabel: "Normal 70–99 mg/dL · Prediabetes 100–125 · Diabetes ≥ 126 mg/dL",
        normalLine: { value: 100, label: "Normal <100", color: "#0D9488" },
        cautionLine: { value: 126, label: "Diabetes ≥126", color: "#DC2626" },
        domainMin: 65,
      },
      post_prandial_glucose: {
        canonicalName: "post_prandial_glucose",
        displayName: "Post-Meal Blood Sugar (PPBS)",
        unit: "mg/dL",
        higherIsBetter: false,
        targetLabel: "Normal < 140 mg/dL · Prediabetes 140–199 · Diabetes ≥ 200 mg/dL",
        normalLine: { value: 140, label: "Normal <140", color: "#0D9488" },
        cautionLine: { value: 200, label: "Diabetes ≥200", color: "#DC2626" },
        domainMin: 80,
      },
      ldl_cholesterol: {
        canonicalName: "ldl_cholesterol",
        displayName: "LDL Cholesterol",
        unit: "mg/dL",
        higherIsBetter: false,
        targetLabel: "Optimal < 100 mg/dL · Borderline 130–159 · High ≥ 160 mg/dL",
        normalLine: { value: 100, label: "Optimal <100", color: "#0D9488" },
        cautionLine: { value: 130, label: "Borderline ≥130", color: "#D97706" },
        domainMin: 40,
      },
      triglycerides: {
        canonicalName: "triglycerides",
        displayName: "Triglycerides",
        unit: "mg/dL",
        higherIsBetter: false,
        targetLabel: "Normal < 150 mg/dL · Borderline 150–199 · High ≥ 200 mg/dL",
        normalLine: { value: 150, label: "Normal <150", color: "#0D9488" },
        cautionLine: { value: 200, label: "High ≥200", color: "#DC2626" },
        domainMin: 50,
      },
      hdl_cholesterol: {
        canonicalName: "hdl_cholesterol",
        displayName: "HDL Cholesterol (Protective)",
        unit: "mg/dL",
        higherIsBetter: true,
        targetLabel: "Protective ≥ 40 mg/dL (Men) / ≥ 50 mg/dL (Women)",
        normalLine: { value: 45, label: "Target ≥45", color: "#0D9488" },
        domainMin: 20,
      },
      serum_creatinine: {
        canonicalName: "serum_creatinine",
        displayName: "Serum Creatinine",
        unit: "mg/dL",
        higherIsBetter: false,
        targetLabel: "Typical reference 0.6–1.2 mg/dL",
        normalLine: { value: 1.2, label: "Ref upper 1.2", color: "#0D9488" },
        domainMin: 0.4,
      },
      egfr: {
        canonicalName: "egfr",
        displayName: "Kidney Filtration (eGFR)",
        unit: "mL/min/1.73m²",
        higherIsBetter: true,
        targetLabel: "Normal ≥ 90 · Mildly reduced 60–89 · Decreased < 60 mL/min/1.73m²",
        normalLine: { value: 90, label: "Normal ≥90", color: "#0D9488" },
        cautionLine: { value: 60, label: "Decreased <60", color: "#DC2626" },
        domainMin: 15,
      },
    };

    const discovered = new Map<
      string,
      {
        canonicalName: string;
        displayName: string;
        unit: string;
        higherIsBetter: boolean;
        targetLabel: string;
        normalLine?: { value: number; label: string; color: string };
        cautionLine?: { value: number; label: string; color: string };
        domainMin?: number;
        points: {
          reportId: string;
          date: string;
          shortDate: string;
          labName: string;
          value: number;
          isCurrentReport: boolean;
        }[];
      }
    >();

    for (const rep of chronologicalReports) {
      for (const v of rep.values) {
        const preset = metaByCanonical[v.canonicalName];
        if (!discovered.has(v.canonicalName)) {
          discovered.set(v.canonicalName, {
            canonicalName: v.canonicalName,
            displayName: preset?.displayName || v.displayName,
            unit: preset?.unit || v.unit,
            higherIsBetter: preset?.higherIsBetter ?? false,
            targetLabel:
              preset?.targetLabel ||
              (v.refLow !== undefined && v.refHigh !== undefined
                ? `Lab reference range: ${v.refLow}–${v.refHigh} ${v.unit}`
                : `Unit: ${v.unit}`),
            normalLine: preset?.normalLine,
            cautionLine: preset?.cautionLine,
            domainMin: preset?.domainMin,
            points: [],
          });
        }
        discovered.get(v.canonicalName)!.points.push({
          reportId: rep.id,
          date: rep.date,
          shortDate: rep.date.slice(5),
          labName: rep.labName,
          value: v.value,
          isCurrentReport: rep.id === report?.id,
        });
      }

      // Also include calculated eGFR if not already explicitly in rep.values
      const hasExplicitEgfr = rep.values.some((v) => v.canonicalName === "egfr");
      if (!hasExplicitEgfr && rep.engineOutput.calculatedEgfr) {
        const preset = metaByCanonical["egfr"];
        if (!discovered.has("egfr")) {
          discovered.set("egfr", {
            ...preset,
            points: [],
          });
        }
        discovered.get("egfr")!.points.push({
          reportId: rep.id,
          date: rep.date,
          shortDate: rep.date.slice(5),
          labName: rep.labName,
          value: rep.engineOutput.calculatedEgfr.value,
          isCurrentReport: rep.id === report?.id,
        });
      }
    }

    const priorityOrder = [
      "hba1c",
      "systolic_bp",
      "fasting_glucose",
      "post_prandial_glucose",
      "diastolic_bp",
      "ldl_cholesterol",
      "triglycerides",
      "egfr",
      "serum_creatinine",
      "hdl_cholesterol",
    ];

    return Array.from(discovered.values()).sort((a, b) => {
      const idxA = priorityOrder.indexOf(a.canonicalName);
      const idxB = priorityOrder.indexOf(b.canonicalName);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.displayName.localeCompare(b.displayName);
    });
  }, [chronologicalReports, report?.id]);

  const activeLongitudinalSeries = useMemo(() => {
    if (longitudinalMetricsCatalog.length === 0) return null;
    return (
      longitudinalMetricsCatalog.find(
        (m) => m.canonicalName === selectedLongitudinalMetric
      ) || longitudinalMetricsCatalog[0]
    );
  }, [longitudinalMetricsCatalog, selectedLongitudinalMetric]);

  const reportTrendAlerts = useMemo(() => {
    const list =
      allProfileReports.length > 0
        ? allProfileReports
        : report
          ? [report]
          : [];
    return detectReportUpwardTrends(list, trendAlertConfig);
  }, [allProfileReports, report, trendAlertConfig]);

  if (!report) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center space-y-4">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          No report selected for {profile.customName}
        </h2>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Upload a lab report, scan a monitor reading, or load one of the clearly marked sample reports to view your clinical breakdown and simulator.
        </p>
        <button
          type="button"
          onClick={onAddNewReport}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg"
        >
          <FilePlus2 className="w-4 h-4" />
          <span>Add or Load a Report</span>
        </button>
      </div>
    );
  }

  const { engineOutput, narrative } = report;
  const isCancer = engineOutput.isCancerReport;

  const activeHorizonSet = useMemo(() => {
    if (!engineOutput.horizons) return null;
    if (horizonYears === 2) return engineOutput.horizons.years2;
    if (horizonYears === 10) return engineOutput.horizons.years10;
    return engineOutput.horizons.years5;
  }, [engineOutput.horizons, horizonYears]);

  const simOutput = useMemo(() => {
    if (!engineOutput.horizons) return null;
    return runLifestyleSimulator(
      report.values,
      engineOutput.horizons.years5,
      simInput
    );
  }, [report.values, engineOutput.horizons, simInput]);

  const handleShareDoctorSummary = async () => {
    const text = buildDoctorShareSummary(report, profile);
    const res = await shareOrCopySummary(`Milo Summary — ${profile.customName}`, text);
    if (res.success) {
      setShareFeedback(
        res.method === "web_share"
          ? "Shared doctor summary!"
          : "Doctor summary copied to clipboard!"
      );
      setTimeout(() => setShareFeedback(null), 4000);
    }
  };

  const handleDownloadReportPdf = () => {
    const previousTitle = document.title;
    const safeName = profile.customName.replace(/[^a-zA-Z0-9_-]/g, "_");
    document.title = `Milo_Doctor_Report_${safeName}_${report.date}`;
    setShareFeedback(
      "Opening printer-friendly PDF view — choose 'Save as PDF' in your print dialog."
    );
    window.setTimeout(() => {
      window.print();
      document.title = previousTitle;
    }, 60);
    window.setTimeout(() => setShareFeedback(null), 5000);
  };

  const tabs: { id: ResultTabId; label: string }[] = [
    { id: "summary", label: "01. Summary" },
    { id: "why", label: "02. Why it happens" },
    {
      id: "organs",
      label: isCancer ? "03. Cancer Report Explainer" : "03. Organ impact",
    },
    ...(isCancer
      ? []
      : [
          { id: "trajectory" as const, label: "04. Trajectory" },
          { id: "improve" as const, label: "05. Improve it (Simulator)" },
        ]),
    {
      id: "questions",
      label: isCancer ? "04. Questions for Oncologist" : "06. Questions for your doctor",
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* Interactive Screen Content (hidden automatically during @media print) */}
      <div className={printPreviewMode ? "space-y-6" : "screen-only space-y-6"}>
        {/* Calm Urgent Safety Banner if any value is in the urgent range */}
        {engineOutput.hasUrgentValues && (
          <div className="no-print">
            <UrgentSafetyBanner
              title={dict.safetyBanner.urgentTitle}
              subtitle={dict.safetyBanner.urgentSubtitle}
              alerts={engineOutput.urgentAlerts}
              onLocateCare={onOpenMapsCare}
            />
          </div>
        )}

        {/* 3-Consecutive Entry Upward Trend Monitor & Custom Push Alerts */}
        {!isCancer && (
          <div className="no-print">
            <TrendAlertCenter
              mode="reports"
              alerts={reportTrendAlerts}
              config={trendAlertConfig}
              onUpdateConfig={(cfg) => onUpdateTrendAlertConfig?.(cfg)}
              onSimulateThreeEntryTrend={() => onSimulateReportTrend?.()}
            />
          </div>
        )}

        {/* Report Header & Utility Actions */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 md:p-6 space-y-4 no-print">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-teal-800 dark:text-teal-300">
                  {profile.customName}
                </span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">Report Date: {report.date}</span>
                <span aria-hidden="true">·</span>
                <span>{report.labName}</span>
                {report.isSample && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono font-semibold text-amber-700 dark:text-amber-400">
                      SAMPLE REPORT
                    </span>
                  </>
                )}
              </div>
              <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                {isCancer
                  ? "Pathology & Cancer Report Plain-Language Explainer"
                  : "Confirmed Clinical Report Analysis & Interactive Simulator"}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2 no-print">
              {!isCancer && (
                <button
                  type="button"
                  onClick={() => setCalcDrawerOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  <Calculator className="w-3.5 h-3.5 text-teal-700" />
                  <span>How this is calculated</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleShareDoctorSummary}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Share2 className="w-3.5 h-3.5 text-teal-700" />
                <span>{dict.common.shareSummary}</span>
              </button>

              <button
                type="button"
                onClick={() => setPrintPreviewMode((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  printPreviewMode
                    ? "bg-teal-50 dark:bg-teal-950/50 text-teal-800 dark:text-teal-200 border-teal-300 dark:border-teal-700"
                    : "text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
                title="Toggle printer-friendly doctor appointment sheet preview"
              >
                <Eye className="w-3.5 h-3.5 text-teal-700" />
                <span>{printPreviewMode ? "Exit Print Preview" : "Doctor Print View"}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadReportPdf}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-teal-900 dark:text-teal-100 bg-teal-50 dark:bg-teal-950/60 border border-teal-300 dark:border-teal-700 hover:bg-teal-100 dark:hover:bg-teal-900/60 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <FileDown className="w-3.5 h-3.5 text-teal-700 dark:text-teal-300" />
                <span>Download Report PDF</span>
              </button>

              <button
                type="button"
                disabled={isRegeneratingNarrative}
                onClick={onRegenerateNarrative}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isRegeneratingNarrative ? "animate-spin" : ""}`}
                />
                <span>
                  {isRegeneratingNarrative ? "Refreshing AI..." : "Refresh AI Narrative"}
                </span>
              </button>
            </div>
          </div>

          {shareFeedback && (
            <p className="text-xs font-medium text-teal-700 dark:text-teal-400">
              {shareFeedback}
            </p>
          )}

          {!printPreviewMode && (
            <div className="pt-2 no-print">
              <SegmentedTabs
                tabs={tabs}
                activeTab={activeTab}
                onChange={setActiveTab}
              />
            </div>
          )}
        </div>

      {!printPreviewMode && activeTab === "summary" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Plain-Language Summary
            </h2>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {narrative?.summary ||
                "Your confirmed test values have been classified by Milo's deterministic clinical rules below. Tap 'Refresh AI Narrative' to generate a detailed plain-language summary."}
            </p>
          </div>

          {/* Confirmed Findings Table */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Confirmed Markers & Clinical Classification
              </h3>
              <span className="text-xs text-slate-500">
                Deterministic Rule Engine ({engineOutput.engineVersion})
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500">
                    <th className="py-2.5 pr-4">Marker</th>
                    <th className="py-2.5 px-4 text-right">Value</th>
                    <th className="py-2.5 px-4">Clinical Category</th>
                    <th className="py-2.5 pl-4">What it means & Guideline Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800 text-xs">
                  {engineOutput.findings.map((f, i) => (
                    <tr key={i} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30">
                      <td className="py-3 pr-4 font-semibold text-slate-900 dark:text-slate-100">
                        <div>{f.displayName}</div>
                        {f.isCalculated && (
                          <span className="text-[11px] font-normal text-teal-700 dark:text-teal-400">
                            Calculated via CKD-EPI 2021 (Race-Free)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {f.value} {f.unit}
                      </td>
                      <td className="py-3 px-4">
                        <StatusIndicator status={f.status} label={f.categoryLabel} />
                      </td>
                      <td className="py-3 pl-4 text-slate-600 dark:text-slate-300">
                        <p>{f.plainSummary}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Source: {f.guidelineSource}
                          {f.clinicalReviewNote ? ` · ${f.clinicalReviewNote}` : ""}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Longitudinal Biomarker Trend Chart Across Report History */}
          {!isCancer && activeLongitudinalSeries && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-teal-700 dark:text-teal-400">
                    <TrendingUp className="w-4 h-4" />
                    <span>Longitudinal Biomarker History Across Reports</span>
                  </div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-1">
                    Track How Your Specific Lab Markers Move Over Time
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Select any confirmed biomarker below (such as HbA1c or Systolic BP) to inspect its progression across {profile.customName}&apos;s report history against clinical target thresholds.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {activeLongitudinalSeries.points.length < 3 &&
                    onSimulateReportTrend && (
                      <button
                        type="button"
                        onClick={onSimulateReportTrend}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-800 dark:text-teal-200 bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 hover:bg-teal-100 rounded-lg transition-colors whitespace-nowrap shrink-0"
                      >
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span>Load Sample 3-Visit History</span>
                      </button>
                    )}

                  <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => setLongitudinalChartStyle("line")}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                        longitudinalChartStyle === "line"
                          ? "bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-300 shadow-2xs"
                          : "text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      Line Trend
                    </button>
                    <button
                      type="button"
                      onClick={() => setLongitudinalChartStyle("bar")}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                        longitudinalChartStyle === "bar"
                          ? "bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-300 shadow-2xs"
                          : "text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      Bar View
                    </button>
                  </div>
                </div>
              </div>

              {/* Biomarker Selector Buttons */}
              <div className="flex flex-wrap items-center gap-1.5">
                {longitudinalMetricsCatalog.map((item) => {
                  const isSelected =
                    item.canonicalName === activeLongitudinalSeries.canonicalName;
                  const latestPt = item.points[item.points.length - 1];
                  return (
                    <button
                      key={item.canonicalName}
                      type="button"
                      onClick={() =>
                        setSelectedLongitudinalMetric(item.canonicalName)
                      }
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                        isSelected
                          ? "bg-teal-700 text-white border-teal-700 shadow-2xs"
                          : "bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      <span>{item.displayName}</span>
                      {latestPt && (
                        <span
                          className={`font-mono text-[11px] tabular-nums ${
                            isSelected
                              ? "text-teal-100"
                              : "text-slate-500 dark:text-slate-400"
                          }`}
                        >
                          ({latestPt.value} {item.unit} · {item.points.length}{" "}
                          {item.points.length === 1 ? "pt" : "pts"})
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Longitudinal KPI Summary Strip */}
              {(() => {
                const pts = activeLongitudinalSeries.points;
                const firstPt = pts[0];
                const lastPt = pts[pts.length - 1];
                const rawDelta =
                  pts.length > 1
                    ? Math.round((lastPt.value - firstPt.value) * 100) / 100
                    : 0;
                const isImproved =
                  pts.length > 1 &&
                  (activeLongitudinalSeries.higherIsBetter
                    ? rawDelta > 0
                    : rawDelta < 0);
                const isWorsened =
                  pts.length > 1 &&
                  (activeLongitudinalSeries.higherIsBetter
                    ? rawDelta < 0
                    : rawDelta > 0);

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30">
                      <div className="text-[11px] text-slate-500">
                        Earliest Recorded ({firstPt.date})
                      </div>
                      <div className="font-mono text-base font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
                        {firstPt.value} {activeLongitudinalSeries.unit}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30">
                      <div className="text-[11px] text-slate-500">
                        Latest Recorded ({lastPt.date})
                      </div>
                      <div className="font-mono text-base font-bold text-teal-800 dark:text-teal-300 tabular-nums mt-0.5">
                        {lastPt.value} {activeLongitudinalSeries.unit}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30">
                      <div className="text-[11px] text-slate-500">
                        Net Change Across {pts.length}{" "}
                        {pts.length === 1 ? "Report" : "Reports"}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {pts.length === 1 ? (
                          <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                            Baseline established (1 report)
                          </span>
                        ) : (
                          <>
                            {rawDelta > 0 ? (
                              <TrendingUp
                                className={`w-4 h-4 ${
                                  isImproved ? "text-emerald-600" : "text-amber-600"
                                }`}
                              />
                            ) : rawDelta < 0 ? (
                              <TrendingDown
                                className={`w-4 h-4 ${
                                  isImproved ? "text-emerald-600" : "text-amber-600"
                                }`}
                              />
                            ) : null}
                            <span
                              className={`font-mono text-sm font-bold tabular-nums ${
                                isImproved
                                  ? "text-emerald-700 dark:text-emerald-400"
                                  : isWorsened
                                    ? "text-amber-700 dark:text-amber-400"
                                    : "text-slate-700 dark:text-slate-300"
                              }`}
                            >
                              {rawDelta > 0 ? `+${rawDelta}` : rawDelta}{" "}
                              {activeLongitudinalSeries.unit} (
                              {isImproved
                                ? "Improved"
                                : isWorsened
                                  ? "Upward / Review"
                                  : "Stable"}
                              )
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30">
                      <div className="text-[11px] text-slate-500">
                        Clinical Guideline Reference
                      </div>
                      <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-0.5 leading-snug">
                        {activeLongitudinalSeries.targetLabel}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Recharts Longitudinal Chart */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/40 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {activeLongitudinalSeries.displayName} ({activeLongitudinalSeries.unit}) — Historical Report Curve
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    Dashed lines show clinical reference cutoffs
                  </span>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    {longitudinalChartStyle === "line" ? (
                      <ComposedChart
                        data={activeLongitudinalSeries.points}
                        margin={{ top: 12, right: 24, left: 4, bottom: 4 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 12 }}
                          padding={{ left: 16, right: 16 }}
                        />
                        <YAxis
                          domain={[
                            activeLongitudinalSeries.domainMin ?? "auto",
                            "auto",
                          ]}
                          tick={{ fontSize: 12 }}
                          width={44}
                        />
                        <Tooltip
                          formatter={(val: any) => [
                            `${val} ${activeLongitudinalSeries.unit}`,
                            activeLongitudinalSeries.displayName,
                          ]}
                          labelFormatter={(label: any, payload: any) => {
                            const pt = payload?.[0]?.payload;
                            return pt
                              ? `Report Date: ${label} (${pt.labName})`
                              : `Report Date: ${label}`;
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: "12px" }} />
                        {activeLongitudinalSeries.normalLine && (
                          <ReferenceLine
                            y={activeLongitudinalSeries.normalLine.value}
                            stroke={activeLongitudinalSeries.normalLine.color}
                            strokeDasharray="4 4"
                            label={{
                              value: activeLongitudinalSeries.normalLine.label,
                              position: "insideTopRight",
                              fontSize: 11,
                              fill: activeLongitudinalSeries.normalLine.color,
                            }}
                          />
                        )}
                        {activeLongitudinalSeries.cautionLine && (
                          <ReferenceLine
                            y={activeLongitudinalSeries.cautionLine.value}
                            stroke={activeLongitudinalSeries.cautionLine.color}
                            strokeDasharray="4 4"
                            label={{
                              value: activeLongitudinalSeries.cautionLine.label,
                              position: "insideBottomRight",
                              fontSize: 11,
                              fill: activeLongitudinalSeries.cautionLine.color,
                            }}
                          />
                        )}
                        <Area
                          type="monotone"
                          dataKey="value"
                          name={`${activeLongitudinalSeries.displayName} (${activeLongitudinalSeries.unit})`}
                          fill="#0D9488"
                          fillOpacity={0.12}
                          stroke="none"
                        />
                        <Line
                          type="monotone"
                          dataKey="value"
                          name={`${activeLongitudinalSeries.displayName} (${activeLongitudinalSeries.unit})`}
                          stroke="#0F766E"
                          strokeWidth={2.5}
                          dot={{ r: 5, fill: "#0F766E", strokeWidth: 2, stroke: "#FFFFFF" }}
                          activeDot={{ r: 7 }}
                        />
                      </ComposedChart>
                    ) : (
                      <BarChart
                        data={activeLongitudinalSeries.points}
                        margin={{ top: 12, right: 24, left: 4, bottom: 4 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                        <YAxis
                          domain={[
                            activeLongitudinalSeries.domainMin ?? 0,
                            "auto",
                          ]}
                          tick={{ fontSize: 12 }}
                          width={44}
                        />
                        <Tooltip
                          formatter={(val: any) => [
                            `${val} ${activeLongitudinalSeries.unit}`,
                            activeLongitudinalSeries.displayName,
                          ]}
                        />
                        <Legend wrapperStyle={{ fontSize: "12px" }} />
                        {activeLongitudinalSeries.normalLine && (
                          <ReferenceLine
                            y={activeLongitudinalSeries.normalLine.value}
                            stroke={activeLongitudinalSeries.normalLine.color}
                            strokeDasharray="4 4"
                            label={{
                              value: activeLongitudinalSeries.normalLine.label,
                              position: "insideTopRight",
                              fontSize: 11,
                              fill: activeLongitudinalSeries.normalLine.color,
                            }}
                          />
                        )}
                        {activeLongitudinalSeries.cautionLine && (
                          <ReferenceLine
                            y={activeLongitudinalSeries.cautionLine.value}
                            stroke={activeLongitudinalSeries.cautionLine.color}
                            strokeDasharray="4 4"
                            label={{
                              value: activeLongitudinalSeries.cautionLine.label,
                              position: "insideBottomRight",
                              fontSize: 11,
                              fill: activeLongitudinalSeries.cautionLine.color,
                            }}
                          />
                        )}
                        <Bar
                          dataKey="value"
                          name={`${activeLongitudinalSeries.displayName} (${activeLongitudinalSeries.unit})`}
                          fill="#0D9488"
                          radius={[6, 6, 0, 0]}
                          maxBarSize={54}
                        />
                      </BarChart>
                    )}
                  </ResponsiveContainer>
                </div>

                {/* Accessible Text Summary of Longitudinal Series */}
                <p className="text-xs text-slate-500 pt-1">
                  Text alternative ({activeLongitudinalSeries.displayName}):{" "}
                  {activeLongitudinalSeries.points
                    .map(
                      (pt) =>
                        `${pt.date}: ${pt.value} ${activeLongitudinalSeries.unit} (${pt.labName})`
                    )
                    .join(" → ")}
                  .
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: WHY IT HAPPENS & GLOSSARY */}
      {!printPreviewMode && activeTab === "why" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-3">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Why These Numbers Happen Together
            </h2>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
              {narrative?.whyItHappens ||
                "Blood sugar, blood pressure, blood fats (lipids), and kidney filtration share the same network of blood vessels and metabolic pathways. When insulin sensitivity drops or blood vessel pressure rises, multiple markers shift together."}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-teal-700" />
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Plain-Language Glossary of Terms in Your Report
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(narrative?.glossaryTerms || []).map((g, i) => (
                <div
                  key={i}
                  className="p-4 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30"
                >
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                    {g.term}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                    {g.plainMeaning}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ORGAN IMPACT (OR DEDICATED CANCER REPORT EXPLAINER) */}
      {!printPreviewMode && activeTab === "organs" && (
        <div className="space-y-6">
          {isCancer ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-6">
              <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
                <span className="text-xs font-semibold text-teal-700 dark:text-teal-400">
                  Calm Pathology & Oncology Literacy · No Survival or Risk Numbers
                </span>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mt-1">
                  Understanding Your Pathology / Biopsy Report
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Milo translates technical pathology terms into clear questions for your oncology team. It never predicts prognosis or claims cures.
                </p>
              </div>

              {report.pathologyTerms && report.pathologyTerms.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Terms Found on Your Report
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {report.pathologyTerms.map((pt, i) => (
                      <div
                        key={i}
                        className="p-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40"
                      >
                        <div className="text-xs font-semibold text-teal-800 dark:text-teal-300">
                          {pt.term}
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                          {pt.contextAsPrinted}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    What Grade & Receptor Scores Mean
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {narrative?.cancerExplainer?.stageOrGradePlainMeaning ||
                      "Histologic Grade (Grade 1, 2, or 3) describes how closely the cells resemble normal tissue under the microscope (Grade 2 is intermediate/moderately differentiated). Hormone receptor scores (ER and PR Allred scores out of 8) and HER2 status tell your oncologist which targeted, gentle receptor-blocking therapies can work effectively."}
                  </p>
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Typical Next-Step Conversations with Your Oncologist
                  </h3>
                  <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 list-disc pl-4">
                    {(
                      narrative?.cancerExplainer?.typicalNextStepConversations || [
                        "Reviewing whether any additional imaging or staging checks are needed before treatment planning.",
                        "Discussing multidisciplinary board recommendations (surgical oncology, medical oncology, radiation oncology).",
                        "Understanding how hormone receptor positivity (ER/PR) guides targeted tablet options.",
                      ]
                    ).map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Supportive Care & Side-Effect Awareness
                </h3>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs text-slate-600 dark:text-slate-300">
                  {(
                    narrative?.cancerExplainer?.sideEffectAwareness || [
                      "Ask your care team who to call if you experience fever, unusual fatigue, or soreness.",
                      "Maintain gentle protein intake (dal, curd, paneer, eggs) and hydration during treatment.",
                      "Bring a family member and a written notebook of questions to each oncology appointment.",
                    ]
                  ).map((s, i) => (
                    <li
                      key={i}
                      className="p-3 rounded-lg border border-slate-200/80 dark:border-slate-800"
                    >
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            activeHorizonSet && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                      Organ Relative Risk Index (0 to 100 Scale)
                    </h2>
                    <p className="text-xs text-slate-500">
                      A relative index of vascular and metabolic strain—not a personal probability of disease. Range widens with time horizon.
                    </p>
                  </div>

                  <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg self-start">
                    {([2, 5, 10] as const).map((yr) => (
                      <button
                        key={yr}
                        type="button"
                        onClick={() => setHorizonYears(yr)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                          horizonYears === yr
                            ? "bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-300 shadow-xs"
                            : "text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        {yr}-Year Horizon
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4 Organ Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {(["eyes", "kidneys", "nerves", "heart"] as OrganKey[]).map(
                    (organKey) => {
                      const o = activeHorizonSet.organs[organKey];
                      const note = narrative?.organNotes?.[organKey];
                      return (
                        <div
                          key={organKey}
                          className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/30 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {o.label}
                            </h3>
                            <span className="font-mono text-xs font-semibold text-teal-800 dark:text-teal-300 tabular-nums">
                              {o.band} Band · Index {o.index}/100 (Range {o.lowRange}–{o.highRange})
                            </span>
                          </div>

                          {/* Range Bar */}
                          <div className="relative h-2.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                            <div
                              className="absolute top-0 bottom-0 bg-teal-600/35"
                              style={{
                                left: `${o.lowRange}%`,
                                width: `${Math.max(4, o.highRange - o.lowRange)}%`,
                              }}
                            />
                            <div
                              className="absolute top-0 bottom-0 w-1.5 bg-teal-800 dark:bg-teal-300 rounded-full"
                              style={{ left: `${o.index}%` }}
                            />
                          </div>

                          {note && (
                            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                              {note}
                            </p>
                          )}

                          <div className="text-[11px] text-slate-500 space-y-0.5 pt-2 border-t border-slate-200/70 dark:border-slate-700">
                            <div>
                              <span className="font-semibold text-slate-700 dark:text-slate-300">
                                Key drivers:
                              </span>{" "}
                              {o.topDrivers.join(" · ")}
                            </div>
                            {o.protectiveFactors.length > 0 && (
                              <div>
                                <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                                  Protective:
                                </span>{" "}
                                {o.protectiveFactors.join(" · ")}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>

                {/* Text Alternative for Screen Readers & Clarity */}
                <p className="text-xs text-slate-500 pt-2 border-t border-slate-200 dark:border-slate-800">
                  Text alternative ({horizonYears}-year horizon): Eyes index{" "}
                  {activeHorizonSet.organs.eyes.index} ({activeHorizonSet.organs.eyes.lowRange}–
                  {activeHorizonSet.organs.eyes.highRange}, {activeHorizonSet.organs.eyes.band}),
                  Kidneys index {activeHorizonSet.organs.kidneys.index} (
                  {activeHorizonSet.organs.kidneys.lowRange}–
                  {activeHorizonSet.organs.kidneys.highRange},{" "}
                  {activeHorizonSet.organs.kidneys.band}), Nerves index{" "}
                  {activeHorizonSet.organs.nerves.index} (
                  {activeHorizonSet.organs.nerves.lowRange}–
                  {activeHorizonSet.organs.nerves.highRange},{" "}
                  {activeHorizonSet.organs.nerves.band}), Heart & Vessels index{" "}
                  {activeHorizonSet.organs.heart.index} ({activeHorizonSet.organs.heart.lowRange}–
                  {activeHorizonSet.organs.heart.highRange}, {activeHorizonSet.organs.heart.band}).
                </p>
              </div>
            )
          )}
        </div>
      )}

      {/* TAB 4: TRAJECTORY (2, 5, 10 YEARS) */}
      {!printPreviewMode && activeTab === "trajectory" && engineOutput.trajectories && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                2, 5 & 10-Year Illustrative Trajectories
              </h2>
              <p className="text-xs text-slate-500">
                Compares 3 directional scenarios: No change, Current treatment adherence, and Improved lifestyle.
              </p>
            </div>
            <span className="text-xs font-medium text-amber-800 dark:text-amber-300">
              {engineOutput.trajectories.disclaimer}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Trajectory Chart 1: Overall Relative Risk Index */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Overall Organ Strain Index (Lower is better)
              </h3>
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={engineOutput.trajectories.overallRiskIndex}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} width={35} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                    <Line
                      type="monotone"
                      dataKey="noChange"
                      name="If no change"
                      stroke="#DC2626"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="currentAdherence"
                      name="Treatment adherence"
                      stroke="#D97706"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="improvedLifestyle"
                      name="Adherence + Indian lifestyle"
                      stroke="#0D9488"
                      strokeWidth={2.5}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-slate-500">
                Text alternative: At 10 years, the illustrative index moves to{" "}
                {engineOutput.trajectories.overallRiskIndex[3].noChange} with no change,{" "}
                {engineOutput.trajectories.overallRiskIndex[3].currentAdherence} with adherence, and{" "}
                {engineOutput.trajectories.overallRiskIndex[3].improvedLifestyle} with combined lifestyle + adherence.
              </p>
            </div>

            {/* Trajectory Chart 2: HbA1c Trajectory */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                HbA1c (%) Trajectory Across Scenarios
              </h3>
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={engineOutput.trajectories.hba1c}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis domain={[4.5, 11]} tick={{ fontSize: 12 }} width={35} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                    <Line
                      type="monotone"
                      dataKey="noChange"
                      name="If no change"
                      stroke="#DC2626"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="currentAdherence"
                      name="Treatment adherence"
                      stroke="#D97706"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="improvedLifestyle"
                      name="Adherence + Indian lifestyle"
                      stroke="#0D9488"
                      strokeWidth={2.5}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-slate-500">
                Text alternative: Starting from {engineOutput.trajectories.hba1c[0].noChange}%,
                5-year illustrative HbA1c is {engineOutput.trajectories.hba1c[2].noChange}% (no
                change) vs {engineOutput.trajectories.hba1c[2].improvedLifestyle}% (improved
                lifestyle).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: IMPROVE IT (BEFORE & AFTER SIMULATOR) */}
      {!printPreviewMode && activeTab === "improve" && simOutput && activeHorizonSet && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-teal-700 dark:text-teal-400">
                <Sliders className="w-4 h-4" />
                <span>Interactive Before & After Lifestyle Simulator</span>
              </div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mt-1">
                See How Small Daily Habits Shift Your Numbers
              </h2>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50/80 dark:bg-amber-950/40 px-3 py-2 text-xs font-medium text-amber-900 dark:text-amber-200">
              {dict.common.illustrativeDisclaimer}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Sliders Column */}
            <div className="lg:col-span-5 space-y-4">
              <div>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span>Weight reduction (%)</span>
                  <span className="font-mono tabular-nums font-semibold text-teal-700">
                    {simInput.weightLossPercent}% ({Math.round((profile.weightKg * simInput.weightLossPercent) / 100 * 10) / 10} kg)
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={10}
                  step={1}
                  value={simInput.weightLossPercent}
                  onChange={(e) =>
                    setSimInput((s) => ({
                      ...s,
                      weightLossPercent: Number(e.target.value),
                    }))
                  }
                  className="w-full accent-teal-700"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span>Brisk walking after meals (minutes/day)</span>
                  <span className="font-mono tabular-nums font-semibold text-teal-700">
                    {simInput.walkingMinutesAfterMeals} mins/day
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={45}
                  step={5}
                  value={simInput.walkingMinutesAfterMeals}
                  onChange={(e) =>
                    setSimInput((s) => ({
                      ...s,
                      walkingMinutesAfterMeals: Number(e.target.value),
                    }))
                  }
                  className="w-full accent-teal-700"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span>Dietary salt reduction (papad, achar, namkeen)</span>
                  <span className="font-mono font-semibold text-teal-700">
                    {simInput.saltReduction === 0
                      ? "No change"
                      : simInput.saltReduction === 1
                        ? "Moderate cut"
                        : "Strict (<5g/day)"}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={1}
                  value={simInput.saltReduction}
                  onChange={(e) =>
                    setSimInput((s) => ({
                      ...s,
                      saltReduction: Number(e.target.value) as 0 | 1 | 2,
                    }))
                  }
                  className="w-full accent-teal-700"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-medium mb-1">
                  <span>Nightly sleep duration (hours)</span>
                  <span className="font-mono tabular-nums font-semibold text-teal-700">
                    {simInput.sleepHours} hrs
                  </span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={9}
                  step={0.5}
                  value={simInput.sleepHours}
                  onChange={(e) =>
                    setSimInput((s) => ({
                      ...s,
                      sleepHours: Number(e.target.value),
                    }))
                  }
                  className="w-full accent-teal-700"
                />
              </div>

              <div className="pt-2 space-y-2.5">
                <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs cursor-pointer">
                  <span className="font-medium">
                    Take prescribed medicines regularly (Adherence)
                  </span>
                  <input
                    type="checkbox"
                    checked={simInput.medicineAdherence}
                    onChange={(e) =>
                      setSimInput((s) => ({
                        ...s,
                        medicineAdherence: e.target.checked,
                      }))
                    }
                    className="rounded accent-teal-700 w-4 h-4"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs cursor-pointer">
                  <span className="font-medium">
                    Step down & stop tobacco completely
                  </span>
                  <input
                    type="checkbox"
                    checked={simInput.tobaccoCessation}
                    onChange={(e) =>
                      setSimInput((s) => ({
                        ...s,
                        tobaccoCessation: e.target.checked,
                      }))
                    }
                    className="rounded accent-teal-700 w-4 h-4"
                  />
                </label>
              </div>
            </div>

            {/* Live Simulated Before & After Chart Column */}
            <div className="lg:col-span-7 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {simOutput.deltaSummary.map((line, i) => (
                  <div
                    key={i}
                    className="p-3.5 rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50/50 dark:bg-teal-950/30 text-xs font-medium text-teal-950 dark:text-teal-200 tabular-nums"
                  >
                    {line}
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  5-Year Organ Relative Risk Index: Before vs. After Habits
                </h3>
                <div className="h-60 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={(["eyes", "kidneys", "nerves", "heart"] as OrganKey[]).map(
                        (k) => ({
                          organ:
                            k === "eyes"
                              ? "Eyes"
                              : k === "kidneys"
                                ? "Kidneys"
                                : k === "nerves"
                                  ? "Nerves"
                                  : "Heart",
                          Before: engineOutput.horizons!.years5.organs[k].index,
                          After: simOutput.organRisks5Year[k].index,
                        })
                      )}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="organ" tick={{ fontSize: 12 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} width={35} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: "12px" }} />
                      <Bar dataKey="Before" fill="#94A3B8" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="After" fill="#0D9488" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-slate-500">
                  Text alternative: Simulated 5-year Heart index moves from{" "}
                  {engineOutput.horizons!.years5.organs.heart.index} to{" "}
                  {simOutput.organRisks5Year.heart.index}; Kidneys from{" "}
                  {engineOutput.horizons!.years5.organs.kidneys.index} to{" "}
                  {simOutput.organRisks5Year.kidneys.index}. {dict.common.illustrativeDisclaimer}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: QUESTIONS FOR YOUR DOCTOR & ACTION ROADMAP */}
      {!printPreviewMode && activeTab === "questions" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-teal-700" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {isCancer
                  ? "Questions to Ask Your Oncologist"
                  : "Questions to Bring to Your Doctor"}
              </h2>
            </div>
            <p className="text-xs text-slate-500">
              Print or share this list on WhatsApp before your consultation so you cover what matters most.
            </p>
            <ol className="space-y-3 text-sm text-slate-800 dark:text-slate-200">
              {(isCancer && narrative?.cancerExplainer?.oncologistQuestions?.length
                ? narrative.cancerExplainer.oncologistQuestions
                : narrative?.doctorQuestions || []
              ).map((q, idx) => (
                <li
                  key={idx}
                  className="p-3.5 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 flex items-start gap-3"
                >
                  <span className="font-mono text-xs font-bold text-teal-700 dark:text-teal-400 mt-0.5">
                    0{idx + 1}.
                  </span>
                  <span>{q}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-teal-700" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Calm Step-by-Step Roadmap
              </h2>
            </div>
            <div className="space-y-3.5">
              {(narrative?.roadmap || []).map((step, i) => (
                <div
                  key={i}
                  className="p-4 rounded-lg border border-slate-200/80 dark:border-slate-800 space-y-1"
                >
                  <div className="text-xs font-mono font-semibold text-teal-700 dark:text-teal-400">
                    {step.timeframe}
                  </div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {step.title}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {step.detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      </div>

      {/* =====================================================================
          PRINTER-FRIENDLY DOCTOR APPOINTMENT SUMMARY (Visible in @media print & Print Preview)
          ===================================================================== */}
      <div
        className={`${
          printPreviewMode
            ? "block rounded-xl border-2 border-teal-700/40 bg-white text-slate-900 p-6 md:p-8 shadow-sm space-y-5"
            : "print-only"
        }`}
      >
        {printPreviewMode && (
          <div className="no-print flex flex-wrap items-center justify-between gap-3 pb-4 mb-2 border-b border-slate-200">
            <div className="text-xs text-slate-600">
              <span className="font-semibold text-teal-800">
                Printer-Friendly Doctor Appointment View
              </span>{" "}
              — This clean layout is automatically used when you click{" "}
              <strong>Download Report PDF</strong>.
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadReportPdf}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print / Save as PDF Now</span>
              </button>
              <button
                type="button"
                onClick={() => setPrintPreviewMode(false)}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-300 hover:bg-slate-100 rounded-lg"
              >
                Back to Interactive Tabs
              </button>
            </div>
          </div>
        )}

        {/* 1. Clinical Header & Patient Profile */}
        <div className="print-section border border-slate-300 rounded-lg p-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b border-slate-200 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-lg text-slate-900">
                  MILO — Doctor Appointment Clinical Summary
                </span>
                <span className="text-xs font-semibold text-teal-800">
                  (Apne app se · Aware, not afraid)
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Confirmed patient laboratory breakdown & consultation question sheet
              </p>
            </div>
            <div className="text-xs text-slate-700 sm:text-right tabular-nums">
              <div>
                <strong>Report Date:</strong> {report.date}
              </div>
              <div>
                <strong>Lab / Source:</strong> {report.labName}
              </div>
              <div>
                <strong>Document Type:</strong> {report.type.toUpperCase()}
                {report.isSample ? " (SAMPLE)" : ""}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 text-xs text-slate-800">
            <div>
              <span className="text-slate-500 block">Patient Profile</span>
              <strong className="font-semibold">
                {profile.customName} ({profile.age} yrs, {profile.sex})
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block">Body Measurements</span>
              <strong className="font-mono tabular-nums">
                {profile.heightCm} cm · {profile.weightKg} kg · Waist {profile.waistCm} cm
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block">Known Conditions</span>
              <strong>
                {profile.conditions.length > 0
                  ? profile.conditions.join(", ")
                  : "None recorded"}
              </strong>
            </div>
            <div>
              <span className="text-slate-500 block">Engine & Guideline Version</span>
              <strong className="font-mono">{engineOutput.engineVersion}</strong>
            </div>
          </div>
        </div>

        {/* 2. Urgent Values or 3-Consecutive Upward Trend Alerts (if present) */}
        {(engineOutput.hasUrgentValues || reportTrendAlerts.length > 0) && (
          <div className="print-section border border-amber-400 rounded-lg p-4 space-y-2">
            <h2 className="text-sm font-bold text-slate-900">
              Priority Clinical Alerts for Physician Review
            </h2>
            {engineOutput.hasUrgentValues && (
              <div className="text-xs text-slate-800 space-y-1">
                <p className="font-semibold text-red-800">
                  {engineOutput.urgentBannerMessage}
                </p>
                <ul className="list-disc pl-4 space-y-0.5">
                  {engineOutput.urgentAlerts.map((u, idx) => (
                    <li key={idx}>
                      <strong>{u.testName}:</strong> {u.value} — {u.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {reportTrendAlerts.length > 0 && (
              <div className="text-xs text-slate-800 space-y-1 pt-1">
                <p className="font-semibold text-amber-900">
                  3-Consecutive Report Upward Trend Detected:
                </p>
                <ul className="list-disc pl-4 space-y-0.5">
                  {reportTrendAlerts.map((a) => (
                    <li key={a.id} className="tabular-nums">
                      <strong>{a.metricLabel}:</strong>{" "}
                      {a.entries
                        .map((p) => `${p.value} ${a.unit} (${p.dateOrTime})`)
                        .join(" → ")}{" "}
                      (Total change: +{a.totalDelta} {a.unit})
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* 3. Plain-Language Executive Summary */}
        <div className="print-section border border-slate-300 rounded-lg p-4 space-y-2">
          <h2 className="text-sm font-bold text-slate-900">
            01. Executive Plain-Language Summary
          </h2>
          <p className="text-xs text-slate-800 leading-relaxed">
            {narrative?.summary ||
              "Confirmed biomarker values classified using deterministic Indian (ICMR-INDIAB) and international (ADA / KDIGO / ACC-AHA) clinical thresholds."}
          </p>
          {narrative?.whyItHappens && (
            <p className="text-xs text-slate-700 leading-relaxed pt-1 border-t border-slate-200">
              <strong>How these markers connect:</strong> {narrative.whyItHappens}
            </p>
          )}
        </div>

        {/* 4. Confirmed Lab Values & Clinical Classification Table */}
        <div className="print-section border border-slate-300 rounded-lg p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">
              02. Confirmed Lab Markers & Clinical Classification
            </h2>
            <span className="text-[11px] text-slate-600">
              Zero AI Number Invention · Verified by User
            </span>
          </div>
          <table className="print-table w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-300 text-slate-700">
                <th className="py-1.5 pr-3 font-semibold">Biomarker</th>
                <th className="py-1.5 px-3 font-semibold text-right">Confirmed Value</th>
                <th className="py-1.5 px-3 font-semibold">Category</th>
                <th className="py-1.5 pl-3 font-semibold">Clinical Context & Guideline Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {engineOutput.findings.map((f, i) => (
                <tr key={i}>
                  <td className="py-2 pr-3 font-semibold text-slate-900">
                    <div>{f.displayName}</div>
                    {f.isCalculated && (
                      <div className="text-[10px] font-normal text-slate-600">
                        Calculated via CKD-EPI 2021 (Race-Free)
                      </div>
                    )}
                  </td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                    {f.value} {f.unit}
                  </td>
                  <td className="py-2 px-3 font-semibold text-slate-800">
                    {f.categoryLabel}
                  </td>
                  <td className="py-2 pl-3 text-slate-700">
                    <div>{f.plainSummary}</div>
                    <div className="text-[10px] text-slate-500">
                      Guideline: {f.guidelineSource}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 5. Organ Relative Risk Index OR Cancer Pathology Breakdown */}
        {isCancer ? (
          <div className="print-section border border-slate-300 rounded-lg p-4 space-y-2.5">
            <h2 className="text-sm font-bold text-slate-900">
              03. Pathology & Oncology Report Plain-Language Breakdown
            </h2>
            {report.pathologyTerms && report.pathologyTerms.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {report.pathologyTerms.map((pt, i) => (
                  <div key={i} className="p-2 border border-slate-200 rounded">
                    <strong>{pt.term}:</strong> {pt.contextAsPrinted}
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-slate-800 leading-relaxed">
              {narrative?.cancerExplainer?.stageOrGradePlainMeaning ||
                "Histologic grade and receptor status help your oncology team tailor treatment options. Discuss surgical, medical, and radiation oncology recommendations with your specialist."}
            </p>
          </div>
        ) : (
          engineOutput.horizons && (
            <div className="print-section border border-slate-300 rounded-lg p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900">
                  03. 5-Year Organ Relative Strain Index (0–100 Illustrative Scale)
                </h2>
                <span className="text-[11px] text-slate-600">
                  {dict.common.illustrativeDisclaimer}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                {(["eyes", "kidneys", "nerves", "heart"] as OrganKey[]).map((k) => {
                  const o = engineOutput.horizons!.years5.organs[k];
                  return (
                    <div key={k} className="p-2.5 border border-slate-200 rounded space-y-1">
                      <div className="font-semibold text-slate-900">{o.label}</div>
                      <div className="font-mono font-bold text-teal-900 tabular-nums">
                        {o.band} Band · {o.index}/100 (Range {o.lowRange}–{o.highRange})
                      </div>
                      <div className="text-[11px] text-slate-600">
                        Drivers: {o.topDrivers.join(", ")}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        )}

        {/* 6. Questions for Doctor & Action Roadmap */}
        <div className="print-section border border-slate-300 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h2 className="text-sm font-bold text-slate-900">
                04. {isCancer ? "Questions for My Oncologist" : "Questions for My Doctor Appointment"}
              </h2>
              <ol className="space-y-1.5 text-xs text-slate-800">
                {(isCancer && narrative?.cancerExplainer?.oncologistQuestions?.length
                  ? narrative.cancerExplainer.oncologistQuestions
                  : narrative?.doctorQuestions || [
                      "What target values should we aim for over the next 3 months based on this report?",
                      "When should I schedule my next follow-up blood or urine check?",
                      "Which daily lifestyle adjustments will make the biggest difference for my numbers?",
                    ]
                ).map((q, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="font-mono font-bold text-slate-700">[ ] {idx + 1}.</span>
                    <span>{q}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="space-y-2">
              <h2 className="text-sm font-bold text-slate-900">
                05. Calm Step-by-Step Prevention Roadmap
              </h2>
              <div className="space-y-1.5 text-xs text-slate-800">
                {(narrative?.roadmap || []).map((step, idx) => (
                  <div key={idx} className="p-2 border border-slate-200 rounded">
                    <div className="font-mono font-semibold text-teal-900">
                      {step.timeframe}: {step.title}
                    </div>
                    <div className="text-slate-700">{step.detail}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 7. Physician Notes & Next Follow-Up Blank Box for Appointment */}
        <div className="print-section border border-slate-300 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">
              06. Doctor&apos;s Notes, Target Goals & Next Follow-Up Date
            </h2>
            <span className="text-[11px] text-slate-500">
              For clinic use during consultation
            </span>
          </div>
          <div className="space-y-4 pt-1 text-xs text-slate-500">
            <div className="border-b border-dashed border-slate-300 pb-3">
              Target HbA1c / BP / LDL Goals:{" "}
            </div>
            <div className="border-b border-dashed border-slate-300 pb-3">
              Prescription / Lifestyle Remarks:{" "}
            </div>
            <div className="flex justify-between pt-1">
              <span>Next Lab Test & Follow-Up Date: _______________________</span>
              <span>Doctor Signature: _______________________</span>
            </div>
          </div>
        </div>

        {/* Clinical Safety Disclaimer Footer */}
        <div className="text-[10px] text-slate-500 flex flex-col sm:flex-row sm:items-center justify-between gap-1 pt-1">
          <span>
            Generated by Milo (Apne app se) — Educational health-literacy companion, not a medical diagnosis or prescription.
          </span>
          <span className="font-mono">
            Sources: ICMR-INDIAB · ADA · KDIGO 2021 · ACC/AHA
          </span>
        </div>
      </div>

      {/* "How this is calculated" Drawer */}
      <DrawerModal
        open={calcDrawerOpen}
        onClose={() => setCalcDrawerOpen(false)}
        title="How Milo Calculates Classifications, eGFR & Relative Risk Indices"
      >
        <div className="space-y-4 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
          <p>
            <strong>1. Zero AI Number Invention:</strong> The AI only reads printed characters and writes plain-language explanations. Every clinical threshold, kidney filtration value, and risk band comes from deterministic TypeScript code in{" "}
            <code className="font-mono">src/config/thresholds.ts</code> and{" "}
            <code className="font-mono">src/lib/engine/</code>.
          </p>

          <div className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-1.5">
            <div className="font-semibold text-slate-900 dark:text-slate-100">
              Guideline Sources & Last Reviewed Dates:
            </div>
            <ul className="list-disc pl-4 space-y-1">
              <li>
                <strong>HbA1c & Glucose:</strong> {THRESHOLDS.hba1c.source} (Reviewed{" "}
                {THRESHOLDS.hba1c.lastReviewed}) — Normal &lt;5.7%, Prediabetes 5.7–6.4%,
                Diabetes ≥6.5%.
              </li>
              <li>
                <strong>Blood Pressure:</strong> {THRESHOLDS.bloodPressure.source} (Reviewed{" "}
                {THRESHOLDS.bloodPressure.lastReviewed}) — Normal &lt;120/&lt;80, Elevated
                120–129/&lt;80, Stage 1 130–139 or 80–89, Stage 2 ≥140 or ≥90, Urgent ≥180/120.
              </li>
              <li>
                <strong>Kidney Filtration (eGFR):</strong> {THRESHOLDS.egfr.source} (Reviewed{" "}
                {THRESHOLDS.egfr.lastReviewed}). When not printed on the lab report, Milo calculates eGFR from Serum Creatinine, Age, and Sex using the race-free CKD-EPI 2021 equation and labels it “calculated”.
              </li>
            </ul>
          </div>

          <div className="space-y-1.5">
            <div className="font-semibold text-slate-900 dark:text-slate-100">
              Assumptions Used in This Report:
            </div>
            <ul className="list-disc pl-4 space-y-1">
              {engineOutput.assumptionsUsed.map((a, idx) => (
                <li key={idx}>{a}</li>
              ))}
            </ul>
          </div>
        </div>
      </DrawerModal>
    </div>
  );
}
