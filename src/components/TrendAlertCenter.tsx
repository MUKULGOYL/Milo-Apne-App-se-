import React, { useState, useEffect, useRef } from "react";
import {
  BellRing,
  TrendingUp,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  X,
  Bell,
  ShieldAlert,
} from "lucide-react";
import {
  DEFAULT_TREND_ALERT_CONFIG,
  TrendAlertRuleConfig,
  triggerBrowserOrInAppTrendNotification,
  UpwardTrendAlert,
} from "../lib/engine/trendAlerts";

interface TrendAlertCenterProps {
  mode: "reports" | "daily_log";
  alerts: UpwardTrendAlert[];
  config: TrendAlertRuleConfig;
  onUpdateConfig: (nextConfig: TrendAlertRuleConfig) => void;
  onSimulateThreeEntryTrend: () => void;
}

export const TrendAlertCenter: React.FC<TrendAlertCenterProps> = ({
  mode,
  alerts,
  config,
  onUpdateConfig,
  onSimulateThreeEntryTrend,
}) => {
  const [showSettings, setShowSettings] = useState(false);
  const [toastAlert, setToastAlert] = useState<{
    title: string;
    body: string;
    channelNote: string;
  } | null>(null);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const notifiedIdsRef = useRef<Set<string>>(new Set());

  const visibleAlerts = alerts.filter((a) => !dismissedIds.includes(a.id));

  // Automatically trigger push / in-app toast when a new 3-consecutive upward trend is detected
  useEffect(() => {
    if (!config.enabled || visibleAlerts.length === 0) return;

    const unnotified = visibleAlerts.find(
      (a) => !notifiedIdsRef.current.has(a.id)
    );
    if (!unnotified) return;

    unnotified.entries.forEach(() => {});
    visibleAlerts.forEach((a) => notifiedIdsRef.current.add(a.id));

    if (config.pushNotificationsEnabled || config.inAppAlertsEnabled) {
      const title = `Milo Trend Alert: ${unnotified.metricLabel}`;
      const body = `${unnotified.headline}. ${unnotified.recommendedAction}`;
      triggerBrowserOrInAppTrendNotification(title, body).then((res) => {
        if (config.inAppAlertsEnabled) {
          setToastAlert({
            title,
            body: unnotified.headline,
            channelNote: res.message,
          });
        }
      });
    }
  }, [visibleAlerts, config.enabled, config.pushNotificationsEnabled, config.inAppAlertsEnabled]);

  const handleManualDispatchAlert = async (alert: UpwardTrendAlert) => {
    const title = `Milo Trend Alert: ${alert.metricLabel}`;
    const body = `${alert.headline}. ${alert.recommendedAction}`;
    const res = await triggerBrowserOrInAppTrendNotification(title, body);
    setToastAlert({
      title,
      body: alert.headline,
      channelNote: res.message,
    });
  };

  const handleSimulateAndNotify = () => {
    setDismissedIds([]);
    notifiedIdsRef.current.clear();
    onSimulateThreeEntryTrend();
  };

  return (
    <div className="space-y-4">
      {/* Floating / Sticky In-App Push Toast Notification */}
      {toastAlert && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border-2 border-amber-500 bg-amber-50 dark:bg-amber-950/90 p-4 shadow-lg text-amber-950 dark:text-amber-100 flex items-start justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-600 text-white flex items-center justify-center shrink-0 mt-0.5">
              <BellRing className="w-5 h-5 animate-bounce" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                  Custom Push / In-App Trend Notification Triggered
                </span>
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                {toastAlert.title}
              </h4>
              <p className="text-xs text-slate-700 dark:text-slate-200 font-mono tabular-nums">
                {toastAlert.body}
              </p>
              <p className="text-[11px] text-amber-800 dark:text-amber-300">
                {toastAlert.channelNote}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setToastAlert(null)}
            aria-label="Dismiss notification toast"
            className="p-1.5 rounded-lg text-amber-800 dark:text-amber-200 hover:bg-amber-200/60 dark:hover:bg-amber-900/60"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main 3-Consecutive Trend Alert Card */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                visibleAlerts.length > 0
                  ? "bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-400"
                  : "bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-400"
              }`}
            >
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  3-Consecutive Entry Upward Trend Monitor (
                  {mode === "reports"
                    ? "Lab Reports: HbA1c, Systolic BP, Glucose, LDL"
                    : "Daily Log: Systolic BP, Glucose, Weight"}
                  )
                </h3>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                    visibleAlerts.length > 0
                      ? "bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                      : "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                  }`}
                >
                  {visibleAlerts.length > 0 ? (
                    <>
                      <AlertTriangle className="w-3 h-3" />
                      {visibleAlerts.length} Upward Trend{" "}
                      {visibleAlerts.length === 1 ? "Alert" : "Alerts"} Active
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3 h-3" />
                      No 3-Entry Upward Spikes
                    </>
                  )}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Automatically checks if key biomarkers climb over 3 consecutive entries and triggers custom push or in-app alerts.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleSimulateAndNotify}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-colors"
              title="Add a realistic 3-entry upward sequence and trigger a live alert"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {mode === "reports"
                  ? "Demo 3-Report Upward Trend"
                  : "Demo 3-Log Upward Trend"}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setShowSettings((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <Sliders className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
              <span>{showSettings ? "Hide Alert Rules" : "Custom Alert Rules"}</span>
            </button>
          </div>
        </div>

        {/* Custom Push & Threshold Configuration Panel */}
        {showSettings && (
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 pb-3">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  Custom Notification Channels & 3-Entry Sensitivity Thresholds
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  An alert fires when Entry 1 &lt; Entry 2 &lt; Entry 3 AND (Entry 3 − Entry 1) meets or exceeds your minimum rise threshold.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onUpdateConfig(DEFAULT_TREND_ALERT_CONFIG)}
                className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline self-start sm:self-center"
              >
                Reset to Clinical Defaults
              </button>
            </div>

            <div className="flex flex-wrap gap-4 text-xs">
              <label className="inline-flex items-center gap-2 font-medium text-slate-800 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={config.enabled}
                  onChange={(e) =>
                    onUpdateConfig({ ...config, enabled: e.target.checked })
                  }
                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                Enable 3-Consecutive Upward Trend Monitor
              </label>

              <label className="inline-flex items-center gap-2 font-medium text-slate-800 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={config.pushNotificationsEnabled}
                  onChange={(e) =>
                    onUpdateConfig({
                      ...config,
                      pushNotificationsEnabled: e.target.checked,
                    })
                  }
                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                Browser Push Notifications
              </label>

              <label className="inline-flex items-center gap-2 font-medium text-slate-800 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={config.inAppAlertsEnabled}
                  onChange={(e) =>
                    onUpdateConfig({
                      ...config,
                      inAppAlertsEnabled: e.target.checked,
                    })
                  }
                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                In-App Alert Banner & Toast
              </label>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  HbA1c Min Rise (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="3.0"
                  value={config.hba1cMinTotalRise}
                  onChange={(e) =>
                    onUpdateConfig({
                      ...config,
                      hba1cMinTotalRise: Math.max(0.1, Number(e.target.value) || 0.1),
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-mono tabular-nums"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Systolic BP Rise (mmHg)
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  max="40"
                  value={config.systolicBpMinTotalRise}
                  onChange={(e) =>
                    onUpdateConfig({
                      ...config,
                      systolicBpMinTotalRise: Math.max(
                        1,
                        Number(e.target.value) || 1
                      ),
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-mono tabular-nums"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Diastolic BP Rise (mmHg)
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  max="25"
                  value={config.diastolicBpMinTotalRise}
                  onChange={(e) =>
                    onUpdateConfig({
                      ...config,
                      diastolicBpMinTotalRise: Math.max(
                        1,
                        Number(e.target.value) || 1
                      ),
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-mono tabular-nums"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Glucose Rise (mg/dL)
                </label>
                <input
                  type="number"
                  step="2"
                  min="2"
                  max="100"
                  value={config.glucoseMinTotalRise}
                  onChange={(e) =>
                    onUpdateConfig({
                      ...config,
                      glucoseMinTotalRise: Math.max(
                        2,
                        Number(e.target.value) || 2
                      ),
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-mono tabular-nums"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  LDL Rise (mg/dL)
                </label>
                <input
                  type="number"
                  step="2"
                  min="2"
                  max="80"
                  value={config.ldlMinTotalRise}
                  onChange={(e) =>
                    onUpdateConfig({
                      ...config,
                      ldlMinTotalRise: Math.max(2, Number(e.target.value) || 2),
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-mono tabular-nums"
                />
              </div>
            </div>
          </div>
        )}

        {/* Active 3-Entry Upward Trend Alert Cards */}
        {visibleAlerts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {visibleAlerts.map((alert) => (
              <div
                key={alert.id}
                role="alert"
                className={`rounded-xl border p-4 space-y-3 ${
                  alert.severity === "high"
                    ? "border-rose-300 dark:border-rose-800 bg-rose-50/60 dark:bg-rose-950/30"
                    : "border-amber-300 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/30"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldAlert
                      className={`w-4 h-4 shrink-0 ${
                        alert.severity === "high"
                          ? "text-rose-700 dark:text-rose-400"
                          : "text-amber-700 dark:text-amber-400"
                      }`}
                    />
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {alert.metricLabel}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-mono tabular-nums font-bold text-rose-700 dark:text-rose-300">
                      +{alert.totalDelta} {alert.unit} (+{alert.pctIncrease}%)
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setDismissedIds((prev) => [...prev, alert.id])
                      }
                      aria-label={`Dismiss ${alert.metricLabel} alert`}
                      className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* 3 Consecutive Entries Stepper */}
                <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800">
                  {alert.entries.map((entry, idx) => (
                    <div
                      key={`${entry.dateOrTime}-${idx}`}
                      className="flex flex-col justify-between"
                    >
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                        #{idx + 1} · {entry.dateOrTime}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span
                          className={`text-xs font-mono tabular-nums font-bold ${
                            idx === 2
                              ? "text-rose-700 dark:text-rose-400"
                              : "text-slate-800 dark:text-slate-200"
                          }`}
                        >
                          {entry.value} {alert.unit}
                        </span>
                        {idx < 2 && (
                          <ArrowRight className="w-3 h-3 text-slate-400 shrink-0 ml-auto" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  {alert.plainExplanation}
                </p>

                <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-teal-800 dark:text-teal-300">
                    <strong>Next Step:</strong> {alert.recommendedAction}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleManualDispatchAlert(alert)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[11px] font-semibold shrink-0 self-start sm:self-center hover:opacity-90"
                  >
                    <Bell className="w-3 h-3" />
                    <span>Send Push Alert</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
            <span>
              No biomarker currently shows 3 consecutive upward entries exceeding your thresholds (e.g., HbA1c +{config.hba1cMinTotalRise}% or Systolic BP +{config.systolicBpMinTotalRise} mmHg).
            </span>
            <button
              type="button"
              onClick={handleSimulateAndNotify}
              className="text-teal-700 dark:text-teal-400 font-semibold hover:underline shrink-0"
            >
              Simulate 3-entry rise to test alert →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
