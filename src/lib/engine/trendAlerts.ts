import { Reading, Report } from "../storage";

export interface TrendAlertRuleConfig {
  enabled: boolean;
  pushNotificationsEnabled: boolean;
  inAppAlertsEnabled: boolean;
  hba1cMinTotalRise: number; // default 0.3 (%)
  systolicBpMinTotalRise: number; // default 5 (mmHg)
  diastolicBpMinTotalRise: number; // default 4 (mmHg)
  glucoseMinTotalRise: number; // default 10 (mg/dL)
  ldlMinTotalRise: number; // default 10 (mg/dL)
  creatinineMinTotalRise: number; // default 0.1 (mg/dL)
  weightMinTotalRise: number; // default 1.0 (kg)
}

export const DEFAULT_TREND_ALERT_CONFIG: TrendAlertRuleConfig = {
  enabled: true,
  pushNotificationsEnabled: true,
  inAppAlertsEnabled: true,
  hba1cMinTotalRise: 0.3,
  systolicBpMinTotalRise: 5,
  diastolicBpMinTotalRise: 4,
  glucoseMinTotalRise: 10,
  ldlMinTotalRise: 10,
  creatinineMinTotalRise: 0.1,
  weightMinTotalRise: 1.0,
};

export interface TrendPointEntry {
  dateOrTime: string;
  value: number;
  label?: string;
}

export interface UpwardTrendAlert {
  id: string;
  source: "reports" | "daily_log";
  metricKey: string;
  metricLabel: string;
  unit: string;
  severity: "elevated" | "high";
  entries: [TrendPointEntry, TrendPointEntry, TrendPointEntry];
  totalDelta: number;
  pctIncrease: number;
  thresholdUsed: number;
  headline: string;
  plainExplanation: string;
  recommendedAction: string;
}

interface MonitoredReportMetric {
  canonicalName: string;
  label: string;
  unit: string;
  getMinRise: (cfg: TrendAlertRuleConfig) => number;
  highThreshold: number;
  explanation: string;
  action: string;
}

const MONITORED_REPORT_METRICS: MonitoredReportMetric[] = [
  {
    canonicalName: "hba1c",
    label: "HbA1c (3-Month Average Glucose)",
    unit: "%",
    getMinRise: (cfg) => cfg.hba1cMinTotalRise,
    highThreshold: 7.0,
    explanation:
      "HbA1c has risen across 3 consecutive lab reports, indicating that average blood glucose over the past 8–12 weeks is steadily climbing rather than fluctuating randomly.",
    action:
      "Start a 15-minute brisk walk within 20 minutes after lunch and dinner, rebalance your plate (½ sabzi/salad, ¼ dal/protein, ¼ whole grain), and share this 3-report trend with your physician.",
  },
  {
    canonicalName: "systolic_bp",
    label: "Systolic Blood Pressure",
    unit: "mmHg",
    getMinRise: (cfg) => cfg.systolicBpMinTotalRise,
    highThreshold: 140,
    explanation:
      "Systolic blood pressure has increased over 3 consecutive reports, placing gradually higher mechanical pressure on heart arteries and kidney filters.",
    action:
      "Cut hidden dietary sodium (pickles, papad, namkeen, packaged snacks), aim for 7.5 hours of sleep, and review your seated morning BP log with your doctor.",
  },
  {
    canonicalName: "diastolic_bp",
    label: "Diastolic Blood Pressure",
    unit: "mmHg",
    getMinRise: (cfg) => cfg.diastolicBpMinTotalRise,
    highThreshold: 90,
    explanation:
      "Resting arterial pressure between heartbeats has risen across 3 consecutive reports.",
    action:
      "Practice evening relaxation, reduce added table salt below 5g/day, and discuss blood pressure targets at your next clinic visit.",
  },
  {
    canonicalName: "fasting_glucose",
    label: "Fasting Blood Sugar (FBS)",
    unit: "mg/dL",
    getMinRise: (cfg) => cfg.glucoseMinTotalRise,
    highThreshold: 130,
    explanation:
      "Morning fasting blood glucose has climbed across 3 consecutive lab reports, often linked to late-night carbohydrate dinners or overnight hepatic glucose release.",
    action:
      "Finish dinner at least 2.5 hours before bedtime, keep evening rotis/rice light, and walk 15 minutes after dinner.",
  },
  {
    canonicalName: "pp_glucose",
    label: "Post-Prandial Blood Sugar (2-Hr PPBS)",
    unit: "mg/dL",
    getMinRise: (cfg) => cfg.glucoseMinTotalRise,
    highThreshold: 180,
    explanation:
      "2-hour post-meal glucose has risen across 3 consecutive reports, showing larger sugar spikes after meals.",
    action:
      "Use food sequencing (eat salad and sabzi first, then dal/curd, and roti/rice last) followed by a 15-minute walk.",
  },
  {
    canonicalName: "ldl_cholesterol",
    label: "LDL Cholesterol",
    unit: "mg/dL",
    getMinRise: (cfg) => cfg.ldlMinTotalRise,
    highThreshold: 130,
    explanation:
      "LDL cholesterol has increased across 3 consecutive lab panels, increasing long-term plaque deposition risk in blood vessels.",
    action:
      "Replace fried snacks, ghee/butter excess, and bakery items with soaked almonds, walnuts, oats, and soluble fibre from dal and green vegetables.",
  },
  {
    canonicalName: "creatinine",
    label: "Serum Creatinine",
    unit: "mg/dL",
    getMinRise: (cfg) => cfg.creatinineMinTotalRise,
    highThreshold: 1.2,
    explanation:
      "Serum creatinine has crept up over 3 consecutive reports, which lowers estimated kidney filtration (eGFR).",
    action:
      "Stay well hydrated, avoid over-the-counter painkillers (NSAIDs), keep blood pressure below 130/80 mmHg, and ask your doctor to review kidney protection.",
  },
  {
    canonicalName: "urine_acr",
    label: "Urine Albumin-to-Creatinine Ratio (ACR)",
    unit: "mg/g",
    getMinRise: () => 5,
    highThreshold: 30,
    explanation:
      "Urine albumin leakage has increased over 3 consecutive lab checks, signaling rising pressure inside the kidney filters.",
    action:
      "Discuss kidney-protective blood pressure and glucose targets with your doctor and keep dietary sodium low.",
  },
];

/**
 * Deterministic check for 3 consecutive upward entries across saved lab reports.
 */
export function detectReportUpwardTrends(
  reports: Report[],
  config: TrendAlertRuleConfig = DEFAULT_TREND_ALERT_CONFIG
): UpwardTrendAlert[] {
  if (!config.enabled || reports.length < 3) return [];

  // Sort chronologically (oldest -> newest)
  const chronological = [...reports].sort((a, b) => {
    const cmp = a.date.localeCompare(b.date);
    return cmp !== 0 ? cmp : a.createdAt.localeCompare(b.createdAt);
  });

  const alerts: UpwardTrendAlert[] = [];

  for (const metric of MONITORED_REPORT_METRICS) {
    const points: TrendPointEntry[] = [];

    for (const rep of chronological) {
      const match = rep.values.find(
        (v) => v.canonicalName === metric.canonicalName
      );
      if (match && Number.isFinite(match.value)) {
        points.push({
          dateOrTime: rep.date,
          value: match.value,
          label: rep.labName,
        });
      }
    }

    if (points.length < 3) continue;

    const lastThree = points.slice(-3) as [
      TrendPointEntry,
      TrendPointEntry,
      TrendPointEntry,
    ];
    const [p1, p2, p3] = lastThree;

    const minRise = metric.getMinRise(config);
    const totalDelta = Math.round((p3.value - p1.value) * 100) / 100;

    if (p1.value < p2.value && p2.value < p3.value && totalDelta >= minRise) {
      const pctIncrease =
        p1.value > 0
          ? Math.round(((p3.value - p1.value) / p1.value) * 1000) / 10
          : 0;

      const severity: "elevated" | "high" =
        p3.value >= metric.highThreshold ? "high" : "elevated";

      alerts.push({
        id: `report-trend-${metric.canonicalName}-${p3.dateOrTime}-${p3.value}`,
        source: "reports",
        metricKey: metric.canonicalName,
        metricLabel: metric.label,
        unit: metric.unit,
        severity,
        entries: lastThree,
        totalDelta,
        pctIncrease,
        thresholdUsed: minRise,
        headline: `${metric.label} rose across 3 consecutive reports (${p1.value} → ${p2.value} → ${p3.value} ${metric.unit}, +${totalDelta} ${metric.unit})`,
        plainExplanation: metric.explanation,
        recommendedAction: metric.action,
      });
    }
  }

  return alerts;
}

/**
 * Deterministic check for 3 consecutive upward entries across Daily Log readings
 * (Systolic BP, Diastolic BP, Blood Glucose, Body Weight).
 */
export function detectDailyLogUpwardTrends(
  readings: Reading[],
  config: TrendAlertRuleConfig = DEFAULT_TREND_ALERT_CONFIG
): UpwardTrendAlert[] {
  if (!config.enabled || readings.length < 3) return [];

  const chronological = [...readings].sort((a, b) =>
    a.time.localeCompare(b.time)
  );

  const alerts: UpwardTrendAlert[] = [];

  const formatShortTime = (iso: string) => {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
      return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
      });
    } catch {
      return iso.slice(0, 10);
    }
  };

  // 1. Systolic BP from 'bp' readings
  const bpReadings = chronological.filter((r) => r.kind === "bp");
  if (bpReadings.length >= 3) {
    const last3 = bpReadings.slice(-3);
    const [b1, b2, b3] = last3;
    const totalDelta = Math.round((b3.value - b1.value) * 10) / 10;
    if (
      b1.value < b2.value &&
      b2.value < b3.value &&
      totalDelta >= config.systolicBpMinTotalRise
    ) {
      const pct =
        b1.value > 0
          ? Math.round(((b3.value - b1.value) / b1.value) * 1000) / 10
          : 0;
      alerts.push({
        id: `log-trend-systolic-bp-${b3.id}`,
        source: "daily_log",
        metricKey: "systolic_bp",
        metricLabel: "Logged Systolic Blood Pressure",
        unit: "mmHg",
        severity: b3.value >= 140 ? "high" : "elevated",
        entries: [
          {
            dateOrTime: formatShortTime(b1.time),
            value: b1.value,
            label: b1.context,
          },
          {
            dateOrTime: formatShortTime(b2.time),
            value: b2.value,
            label: b2.context,
          },
          {
            dateOrTime: formatShortTime(b3.time),
            value: b3.value,
            label: b3.context,
          },
        ],
        totalDelta,
        pctIncrease: pct,
        thresholdUsed: config.systolicBpMinTotalRise,
        headline: `Systolic BP rose over 3 consecutive log entries (${b1.value} → ${b2.value} → ${b3.value} mmHg, +${totalDelta} mmHg)`,
        plainExplanation:
          "Your last 3 home or wearable blood pressure logs show a continuous upward climb in systolic pressure.",
        recommendedAction:
          "Rest quietly for 5 minutes before re-checking, skip high-sodium pickles/papad today, ensure you haven't missed a scheduled BP tablet, and share this log with your doctor.",
      });
    }

    // 2. Diastolic BP from 'bp' readings
    const d1 = b1.secondaryValue ?? 0;
    const d2 = b2.secondaryValue ?? 0;
    const d3 = b3.secondaryValue ?? 0;
    const diaDelta = Math.round((d3 - d1) * 10) / 10;
    if (
      d1 > 0 &&
      d1 < d2 &&
      d2 < d3 &&
      diaDelta >= config.diastolicBpMinTotalRise
    ) {
      const pct = Math.round(((d3 - d1) / d1) * 1000) / 10;
      alerts.push({
        id: `log-trend-diastolic-bp-${b3.id}`,
        source: "daily_log",
        metricKey: "diastolic_bp",
        metricLabel: "Logged Diastolic Blood Pressure",
        unit: "mmHg",
        severity: d3 >= 90 ? "high" : "elevated",
        entries: [
          { dateOrTime: formatShortTime(b1.time), value: d1, label: b1.context },
          { dateOrTime: formatShortTime(b2.time), value: d2, label: b2.context },
          { dateOrTime: formatShortTime(b3.time), value: d3, label: b3.context },
        ],
        totalDelta: diaDelta,
        pctIncrease: pct,
        thresholdUsed: config.diastolicBpMinTotalRise,
        headline: `Diastolic BP rose over 3 consecutive log entries (${d1} → ${d2} → ${d3} mmHg, +${diaDelta} mmHg)`,
        plainExplanation:
          "Your lower blood pressure number has climbed across 3 consecutive readings.",
        recommendedAction:
          "Reduce evening salt intake, prioritize 7–8 hours of sleep, and review your home BP trend with your physician.",
      });
    }
  }

  // 3. Blood Glucose from 'glucose' readings
  const glucoseReadings = chronological.filter((r) => r.kind === "glucose");
  if (glucoseReadings.length >= 3) {
    const [g1, g2, g3] = glucoseReadings.slice(-3);
    const totalDelta = Math.round((g3.value - g1.value) * 10) / 10;
    if (
      g1.value < g2.value &&
      g2.value < g3.value &&
      totalDelta >= config.glucoseMinTotalRise
    ) {
      const pct =
        g1.value > 0
          ? Math.round(((g3.value - g1.value) / g1.value) * 1000) / 10
          : 0;
      alerts.push({
        id: `log-trend-glucose-${g3.id}`,
        source: "daily_log",
        metricKey: "glucose",
        metricLabel: "Logged Blood Glucose",
        unit: "mg/dL",
        severity: g3.value >= 180 ? "high" : "elevated",
        entries: [
          {
            dateOrTime: formatShortTime(g1.time),
            value: g1.value,
            label: g1.context,
          },
          {
            dateOrTime: formatShortTime(g2.time),
            value: g2.value,
            label: g2.context,
          },
          {
            dateOrTime: formatShortTime(g3.time),
            value: g3.value,
            label: g3.context,
          },
        ],
        totalDelta,
        pctIncrease: pct,
        thresholdUsed: config.glucoseMinTotalRise,
        headline: `Blood Glucose rose over 3 consecutive log entries (${g1.value} → ${g2.value} → ${g3.value} mg/dL, +${totalDelta} mg/dL)`,
        plainExplanation:
          "Your last 3 logged blood sugar readings show a continuous upward trend.",
        recommendedAction:
          "Take a 15-minute brisk walk after your next meal, pair carbohydrates with extra sabzi and dal, and check that scheduled medicines were taken on time.",
      });
    }
  }

  // 4. Body Weight from 'weight' readings
  const weightReadings = chronological.filter((r) => r.kind === "weight");
  if (weightReadings.length >= 3) {
    const [w1, w2, w3] = weightReadings.slice(-3);
    const totalDelta = Math.round((w3.value - w1.value) * 10) / 10;
    if (
      w1.value < w2.value &&
      w2.value < w3.value &&
      totalDelta >= config.weightMinTotalRise
    ) {
      const pct =
        w1.value > 0
          ? Math.round(((w3.value - w1.value) / w1.value) * 1000) / 10
          : 0;
      alerts.push({
        id: `log-trend-weight-${w3.id}`,
        source: "daily_log",
        metricKey: "weight",
        metricLabel: "Logged Body Weight",
        unit: "kg",
        severity: "elevated",
        entries: [
          { dateOrTime: formatShortTime(w1.time), value: w1.value },
          { dateOrTime: formatShortTime(w2.time), value: w2.value },
          { dateOrTime: formatShortTime(w3.time), value: w3.value },
        ],
        totalDelta,
        pctIncrease: pct,
        thresholdUsed: config.weightMinTotalRise,
        headline: `Body weight rose across 3 consecutive logs (${w1.value} → ${w2.value} → ${w3.value} kg, +${totalDelta} kg)`,
        plainExplanation:
          "Gradual weight gain over 3 consecutive logs can increase insulin resistance and blood pressure.",
        recommendedAction:
          "Check evening snack portions and hidden salt (which causes water retention), and aim for 30 minutes of daily brisk walking.",
      });
    }
  }

  return alerts;
}

/**
 * Dispatches a browser push notification if supported and permitted, returning
 * delivery metadata so the caller can also show an in-app toast banner.
 */
export async function triggerBrowserOrInAppTrendNotification(
  title: string,
  body: string
): Promise<{
  channel: "browser_push_and_in_app" | "in_app_fallback";
  message: string;
}> {
  if (typeof window !== "undefined" && "Notification" in window) {
    try {
      if (Notification.permission === "default") {
        await Notification.requestPermission();
      }
      if (Notification.permission === "granted") {
        new Notification(title, {
          body,
          tag: `milo-trend-${Date.now()}`,
        });
        return {
          channel: "browser_push_and_in_app",
          message: "Dispatched system browser push notification + in-app alert banner.",
        };
      }
    } catch {
      // Fall through to in-app fallback
    }
  }

  return {
    channel: "in_app_fallback",
    message:
      "Browser iframe restricted OS push popups; triggered high-visibility In-App Trend Alert Notification.",
  };
}
