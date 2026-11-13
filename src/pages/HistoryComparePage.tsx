import React, { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  History,
  ArrowLeftRight,
  TrendingDown,
  TrendingUp,
  Minus,
  FileText,
  Trash2,
  Eye,
  PlusCircle,
  CheckCircle2,
} from "lucide-react";
import { Card, StatusBadge, SectionHeader } from "../components/ui/DesignSystem";
import { Report } from "../lib/storage";
import { compareTwoReports } from "../lib/share";

interface HistoryComparePageProps {
  reports: Report[];
  activeReportId: string | null;
  onSelectReport: (reportId: string) => void;
  onDeleteReport: (reportId: string) => void;
  onAddNewReport: () => void;
}

const TRACKED_BIOMARKERS = [
  { key: "hba1c", label: "HbA1c (%)", unit: "%", color: "#0d9488" },
  { key: "fasting_glucose", label: "Fasting Blood Sugar (mg/dL)", unit: "mg/dL", color: "#0284c7" },
  { key: "systolic_bp", label: "Systolic BP (mmHg)", unit: "mmHg", color: "#d97706" },
  { key: "ldl_cholesterol", label: "LDL Cholesterol (mg/dL)", unit: "mg/dL", color: "#7c3aed" },
  { key: "egfr", label: "eGFR Kidney Function", unit: "mL/min/1.73m²", color: "#059669" },
];

export const HistoryComparePage: React.FC<HistoryComparePageProps> = ({
  reports,
  activeReportId,
  onSelectReport,
  onDeleteReport,
  onAddNewReport,
}) => {
  const sortedReports = useMemo(() => {
    return [...reports].sort((a, b) => a.date.localeCompare(b.date));
  }, [reports]);

  const [selectedMetric, setSelectedMetric] = useState<string>("hba1c");
  const [olderReportId, setOlderReportId] = useState<string>(
    sortedReports.length >= 2
      ? sortedReports[sortedReports.length - 2].id
      : sortedReports[0]?.id || ""
  );
  const [newerReportId, setNewerReportId] = useState<string>(
    sortedReports.length >= 1 ? sortedReports[sortedReports.length - 1].id : ""
  );

  const trendSeries = useMemo(() => {
    return sortedReports
      .map((rep) => {
        const found = rep.engineOutput.findings.find(
          (v) => v.canonicalName === selectedMetric
        );
        if (!found) return null;
        return {
          date: rep.date,
          lab: rep.labName,
          value: found.value,
          unit: found.unit,
          status: found.status,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [sortedReports, selectedMetric]);

  const olderReport = useMemo(
    () => reports.find((r) => r.id === olderReportId) || null,
    [reports, olderReportId]
  );
  const newerReport = useMemo(
    () => reports.find((r) => r.id === newerReportId) || null,
    [reports, newerReportId]
  );

  const comparison = useMemo(() => {
    if (!olderReport || !newerReport || olderReport.id === newerReport.id)
      return null;
    return compareTwoReports(olderReport, newerReport);
  }, [olderReport, newerReport]);

  const activeMetricMeta =
    TRACKED_BIOMARKERS.find((m) => m.key === selectedMetric) ||
    TRACKED_BIOMARKERS[0];

  if (reports.length === 0) {
    return (
      <div className="max-w-4xl mx-auto py-12">
        <Card className="text-center py-12 space-y-4">
          <History className="w-12 h-12 text-teal-600 mx-auto" />
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            No Reports Saved Yet
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 max-w-md mx-auto">
            Upload a lab report or load one of Milo’s realistic Indian sample reports to track biomarker trends and compare reports side-by-side.
          </p>
          <button
            type="button"
            onClick={onAddNewReport}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            Add or Try a Sample Report
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400">
            Longitudinal Health Timeline
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mt-0.5">
            Report History & Side-by-Side Comparison
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
            See what improved, what needs attention, and how your numbers respond to lifestyle and doctor-guided care over time.
          </p>
        </div>
        <button
          type="button"
          onClick={onAddNewReport}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition-colors self-start"
        >
          <PlusCircle className="w-4 h-4" />
          Add Another Report
        </button>
      </div>

      {/* Biomarker Trend Line Chart + Plain-Language Text Alternative */}
      <Card>
        <SectionHeader
          title="1. Biomarker Trend Over Time"
          subtitle="Select a key marker to inspect how your numbers have moved across saved lab dates."
          icon={<History className="w-5 h-5" />}
        />

        <div className="flex flex-wrap gap-2 mb-6">
          {TRACKED_BIOMARKERS.map((biomarker) => (
            <button
              key={biomarker.key}
              type="button"
              onClick={() => setSelectedMetric(biomarker.key)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                selectedMetric === biomarker.key
                  ? "bg-teal-600 text-white border-teal-600 shadow-xs"
                  : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-teal-400"
              }`}
            >
              {biomarker.label}
            </button>
          ))}
        </div>

        {trendSeries.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <div className="lg:col-span-8 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={trendSeries}
                  margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} domain={["auto", "auto"]} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "12px",
                      border: "1px solid #cbd5e1",
                      fontSize: "12px",
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    name={activeMetricMeta.label}
                    stroke={activeMetricMeta.color}
                    strokeWidth={3}
                    dot={{ r: 5, fill: activeMetricMeta.color }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="lg:col-span-4 space-y-2.5 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Accessible Text Summary
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                {trendSeries.length === 1
                  ? `Single recorded value for ${activeMetricMeta.label}: ${trendSeries[0].value} ${trendSeries[0].unit} on ${trendSeries[0].date} (${trendSeries[0].lab}). Add another report to view trend direction.`
                  : `Across ${trendSeries.length} reports, ${activeMetricMeta.label} moved from ${trendSeries[0].value} ${trendSeries[0].unit} (${trendSeries[0].date}) to ${trendSeries[trendSeries.length - 1].value} ${trendSeries[trendSeries.length - 1].unit} (${trendSeries[trendSeries.length - 1].date}).`}
              </p>
              <ul className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-700 text-xs">
                {trendSeries.map((pt, idx) => (
                  <li
                    key={`${pt.date}-${idx}`}
                    className="flex items-center justify-between"
                  >
                    <span className="text-slate-600 dark:text-slate-400">
                      {pt.date}
                    </span>
                    <span className="font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                      {pt.value} {pt.unit}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="p-6 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
            No saved reports contain <strong>{activeMetricMeta.label}</strong> yet. Try selecting another biomarker tab above or adding a report with this test.
          </div>
        )}
      </Card>

      {/* Side-by-Side Comparison of Any Two Reports */}
      <Card>
        <SectionHeader
          title="2. Compare Any Two Reports ('What Changed')"
          subtitle="Select an earlier baseline report and a newer follow-up report to see exact numerical and directional changes."
          icon={<ArrowLeftRight className="w-5 h-5" />}
        />

        {reports.length < 2 ? (
          <div className="p-5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <strong>You currently have 1 report saved.</strong> Add a second report (or load a second sample report from the Add Report screen) to unlock side-by-side comparison.
            </div>
            <button
              type="button"
              onClick={onAddNewReport}
              className="px-3.5 py-2 rounded-lg bg-amber-600 text-white font-semibold shrink-0"
            >
              Add Second Report
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                  Earlier / Baseline Report
                </label>
                <select
                  value={olderReportId}
                  onChange={(e) => setOlderReportId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm font-medium text-slate-900 dark:text-white"
                >
                  {sortedReports.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.date} — {r.labName} ({r.type})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">
                  Newer / Follow-Up Report
                </label>
                <select
                  value={newerReportId}
                  onChange={(e) => setNewerReportId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm font-medium text-slate-900 dark:text-white"
                >
                  {sortedReports.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.date} — {r.labName} ({r.type})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {olderReportId === newerReportId ? (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Please select two different reports above to compare changes.
              </p>
            ) : !comparison || comparison.items.length === 0 ? (
              <p className="text-xs text-slate-600 dark:text-slate-400">
                These two reports do not share common overlapping tests (for example, one is a pathology report and one is a blood panel).
              </p>
            ) : (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 text-xs text-teal-950 dark:text-teal-200">
                  <div className="font-bold">{comparison.overallHeadline}</div>
                  {comparison.actionableInsights.length > 0 && (
                    <ul className="list-disc list-inside mt-1.5 space-y-1 text-slate-700 dark:text-slate-300">
                      {comparison.actionableInsights.map((ins, i) => (
                        <li key={i}>{ins}</li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase">
                        <th className="py-2.5 px-3">Biomarker</th>
                        <th className="py-2.5 px-3">
                          Earlier ({olderReport?.date})
                        </th>
                        <th className="py-2.5 px-3">
                          Newer ({newerReport?.date})
                        </th>
                        <th className="py-2.5 px-3">Net Change</th>
                        <th className="py-2.5 px-3">Clinical Direction</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                      {comparison.items.map((d) => (
                        <tr
                          key={d.canonicalName}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                        >
                          <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">
                            {d.displayName}
                          </td>
                          <td className="py-3 px-3 font-mono tabular-nums text-slate-600 dark:text-slate-300">
                            {d.earlierValue} {d.unit}
                          </td>
                          <td className="py-3 px-3 font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                            {d.laterValue} {d.unit}
                          </td>
                          <td className="py-3 px-3 font-mono tabular-nums">
                            {d.delta > 0 ? `+${d.delta}` : d.delta} {d.unit}
                          </td>
                          <td className="py-3 px-3">
                            {d.direction === "improved" && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold">
                                <TrendingDown className="w-3.5 h-3.5" />
                                Improved
                              </span>
                            )}
                            {d.direction === "worsened" && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-semibold">
                                <TrendingUp className="w-3.5 h-3.5" />
                                Needs Attention
                              </span>
                            )}
                            {d.direction === "unchanged" && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                                <Minus className="w-3.5 h-3.5" />
                                Stable
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* All Saved Reports List */}
      <Card>
        <SectionHeader
          title="3. Saved Reports on This Device"
          subtitle="Click 'Open Report' to view full organ insights, interactive simulator, and doctor summary."
          icon={<FileText className="w-5 h-5" />}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sortedReports.map((rep) => {
            const isCurrent = rep.id === activeReportId;
            return (
              <div
                key={rep.id}
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                  isCurrent
                    ? "border-teal-600 bg-teal-50/30 dark:bg-teal-950/20"
                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-xs font-mono font-bold text-teal-700 dark:text-teal-400">
                        {rep.date}
                      </span>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        {rep.labName}
                      </h3>
                    </div>
                    {isCurrent && (
                      <StatusBadge tone="normal">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Active View
                      </StatusBadge>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 line-clamp-2">
                    {rep.narrative?.summary ||
                      `${rep.engineOutput.findings.length} biomarkers analyzed (${rep.type})`}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-200/70 dark:border-slate-800">
                  <span className="text-[11px] text-slate-500">
                    {rep.engineOutput.findings.length} values · Type: {rep.type}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onSelectReport(rep.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      Open Report
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteReport(rep.id)}
                      aria-label={`Delete report from ${rep.date}`}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};
