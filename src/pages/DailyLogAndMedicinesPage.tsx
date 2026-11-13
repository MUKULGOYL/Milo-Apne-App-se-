import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Bell,
  BellRing,
  Calendar,
  Check,
  Clock,
  Pill,
  Plus,
  Trash2,
  TrendingUp,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { WearableHub } from "../components/WearableHub";
import { TrendAlertCenter } from "../components/TrendAlertCenter";
import {
  DEFAULT_TREND_ALERT_CONFIG,
  detectDailyLogUpwardTrends,
  TrendAlertRuleConfig,
} from "../lib/engine";
import {
  AppointmentReminder,
  Medicine,
  Profile,
  Reading,
  ReadingContext,
} from "../lib/storage";

export function DailyLogAndMedicinesPage({
  profile,
  readings,
  medicines,
  appointments,
  notificationsEnabled,
  trendAlertConfig = DEFAULT_TREND_ALERT_CONFIG,
  onUpdateTrendAlertConfig,
  onSimulateLogTrend,
  onAddReadings,
  onAddMedicine,
  onToggleMedicineTaken,
  onDeleteMedicine,
  onAddAppointment,
  onEnableNotifications,
}: {
  profile: Profile;
  readings: Reading[];
  medicines: Medicine[];
  appointments: AppointmentReminder[];
  notificationsEnabled: boolean;
  trendAlertConfig?: TrendAlertRuleConfig;
  onUpdateTrendAlertConfig?: (cfg: TrendAlertRuleConfig) => void;
  onSimulateLogTrend?: () => void;
  onAddReadings: (items: Omit<Reading, "id">[]) => void;
  onAddMedicine: (med: Omit<Medicine, "id" | "adherenceLog">) => void;
  onToggleMedicineTaken: (medId: string, dateTimeKey: string) => void;
  onDeleteMedicine: (medId: string) => void;
  onAddAppointment: (appt: Omit<AppointmentReminder, "id">) => void;
  onEnableNotifications: (granted: boolean) => void;
}) {
  // Fast log inputs
  const [glucoseVal, setGlucoseVal] = useState("116");
  const [glucoseContext, setGlucoseContext] = useState<ReadingContext>("fasting");

  const [sysVal, setSysVal] = useState("128");
  const [diaVal, setDiaVal] = useState("82");
  const [pulseVal, setPulseVal] = useState("74");
  const [bpContext, setBpContext] = useState<ReadingContext>("morning");

  const [weightVal, setWeightVal] = useState(String(profile.weightKg || 75));

  // Medicine form
  const [medName, setMedName] = useState("");
  const [medNote, setMedNote] = useState("");
  const [medTime, setMedTime] = useState("08:30");
  const [medSecondTime, setMedSecondTime] = useState("");
  const [notifFeedback, setNotifFeedback] = useState<string | null>(null);

  // Real-time Medicine Notification System state
  const [nowDate, setNowDate] = useState<Date>(() => new Date());
  const [chimeEnabled, setChimeEnabled] = useState<boolean>(true);
  const [snoozedUntilMap, setSnoozedUntilMap] = useState<Record<string, number>>(
    {}
  );
  const [dismissedDoseKeys, setDismissedDoseKeys] = useState<
    Record<string, boolean>
  >({});
  const [simulatedDueOverrides, setSimulatedDueOverrides] = useState<
    Record<string, string>
  >({});
  const notifiedDoseKeysRef = useRef<Set<string>>(new Set());

  // Appointment form
  const [apptTitle, setApptTitle] = useState("");
  const [apptDoctor, setApptDoctor] = useState("");
  const [apptDate, setApptDate] = useState("2026-12-15");
  const [apptTime, setApptTime] = useState("10:30");

  const dailyLogTrendAlerts = useMemo(
    () => detectDailyLogUpwardTrends(readings, trendAlertConfig),
    [readings, trendAlertConfig]
  );

  const glucoseReadings = useMemo(
    () =>
      readings
        .filter((r) => r.kind === "glucose")
        .sort((a, b) => a.time.localeCompare(b.time)),
    [readings]
  );

  const bpReadings = useMemo(
    () =>
      readings
        .filter((r) => r.kind === "bp")
        .sort((a, b) => a.time.localeCompare(b.time)),
    [readings]
  );

  // Calculate Percent in Range (Glucose 70–140 fasting / 70–180 post-meal; BP <135/<85)
  const glucoseInRangePct = useMemo(() => {
    if (glucoseReadings.length === 0) return 100;
    const inRange = glucoseReadings.filter((r) => {
      if (r.context === "fasting") return r.value >= 70 && r.value <= 130;
      return r.value >= 70 && r.value <= 180;
    }).length;
    return Math.round((inRange / glucoseReadings.length) * 100);
  }, [glucoseReadings]);

  const bpInRangePct = useMemo(() => {
    if (bpReadings.length === 0) return 100;
    const inRange = bpReadings.filter(
      (r) => r.value < 135 && (r.secondaryValue ?? 80) < 85
    ).length;
    return Math.round((inRange / bpReadings.length) * 100);
  }, [bpReadings]);

  const handleLogGlucose = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(glucoseVal);
    if (!num || num < 20 || num > 800) return;
    onAddReadings([
      {
        profileId: profile.id,
        kind: "glucose",
        value: num,
        context: glucoseContext,
        time: new Date().toISOString(),
        source: "manual",
      },
    ]);
  };

  const handleLogBp = (e: React.FormEvent) => {
    e.preventDefault();
    const s = Number(sysVal);
    const d = Number(diaVal);
    if (!s || !d) return;
    onAddReadings([
      {
        profileId: profile.id,
        kind: "bp",
        value: s,
        secondaryValue: d,
        pulseValue: Number(pulseVal) || undefined,
        context: bpContext,
        time: new Date().toISOString(),
        source: "manual",
      },
    ]);
  };

  const handleLogWeight = (e: React.FormEvent) => {
    e.preventDefault();
    const w = Number(weightVal);
    if (!w) return;
    onAddReadings([
      {
        profileId: profile.id,
        kind: "weight",
        value: w,
        context: "morning",
        time: new Date().toISOString(),
        source: "manual",
      },
    ]);
  };

  const playGentleReminderChime = () => {
    if (!chimeEnabled || typeof window === "undefined") return;
    try {
      const AudioCtx =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(523.25, now); // C5
      osc1.frequency.setValueAtTime(659.25, now + 0.18); // E5
      gain1.gain.setValueAtTime(0.001, now);
      gain1.gain.exponentialRampToValueAtTime(0.12, now + 0.04);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.56);
    } catch {
      // Ignore audio autoplay restrictions
    }
  };

  const handleRequestNotifications = async () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      try {
        const perm = await Notification.requestPermission();
        if (perm === "granted") {
          onEnableNotifications(true);
          new Notification("Milo Medicine Reminders Active", {
            body: "You will receive gentle in-app and browser reminder alerts when your scheduled doses are due.",
          });
          setNotifFeedback(
            "Browser push notifications and live schedule alerts are enabled."
          );
          return;
        }
      } catch {
        // Fallback below
      }
    }
    onEnableNotifications(true);
    setNotifFeedback(
      "Live in-app medication schedule monitor, audio chime, and adherence alerts are active."
    );
  };

  // Tick clock every 15 seconds to evaluate medicine schedule times
  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowDate(new Date());
    }, 15_000);
    return () => window.clearInterval(interval);
  }, []);

  const todayStr = useMemo(() => {
    const y = nowDate.getFullYear();
    const m = String(nowDate.getMonth() + 1).padStart(2, "0");
    const d = String(nowDate.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, [nowDate]);

  const currentMinutesOfDay =
    nowDate.getHours() * 60 + nowDate.getMinutes();
  const currentTimeFormatted = `${String(nowDate.getHours()).padStart(2, "0")}:${String(
    nowDate.getMinutes()
  ).padStart(2, "0")}`;

  // Evaluate every scheduled dose in `medicines` against current time
  const scheduledDosesToday = useMemo(() => {
    const items: {
      doseId: string;
      medId: string;
      medName: string;
      medNote: string;
      scheduledTime: string;
      effectiveTime: string;
      adherenceKey: string;
      taken: boolean;
      status: "taken" | "due_now" | "overdue" | "snoozed" | "upcoming";
      minutesDiff: number; // positive = in the future, negative = in the past
      statusLabel: string;
    }[] = [];

    const nowMs = nowDate.getTime();

    for (const med of medicines) {
      if (!med.active) continue;
      for (const rawTime of med.times) {
        const adherenceKey = `${todayStr}_${rawTime}`;
        const doseId = `${med.id}_${adherenceKey}`;
        const effectiveTime = simulatedDueOverrides[doseId] || rawTime;
        const [hhStr, mmStr] = effectiveTime.split(":");
        const schedMins =
          (Number(hhStr) || 0) * 60 + (Number(mmStr) || 0);
        const minutesDiff = schedMins - currentMinutesOfDay;
        const taken = Boolean(med.adherenceLog?.[adherenceKey]);
        const snoozeUntilMs = snoozedUntilMap[doseId];

        let status: "taken" | "due_now" | "overdue" | "snoozed" | "upcoming" =
          "upcoming";
        let statusLabel = "";

        if (taken) {
          status = "taken";
          statusLabel = `Taken (${rawTime})`;
        } else if (snoozeUntilMs && snoozeUntilMs > nowMs) {
          status = "snoozed";
          const remMins = Math.max(
            1,
            Math.ceil((snoozeUntilMs - nowMs) / 60_000)
          );
          statusLabel = `Snoozed (${remMins}m left)`;
        } else if (
          simulatedDueOverrides[doseId] ||
          (minutesDiff <= 15 && minutesDiff >= -60)
        ) {
          status = "due_now";
          statusLabel =
            minutesDiff > 0
              ? `Due in ${minutesDiff} min (${rawTime})`
              : minutesDiff === 0
                ? `Due right now (${rawTime})`
                : `Due now · ${Math.abs(minutesDiff)}m ago (${rawTime})`;
        } else if (minutesDiff < -60) {
          status = "overdue";
          const hrsOver = Math.floor(Math.abs(minutesDiff) / 60);
          const minsOver = Math.abs(minutesDiff) % 60;
          statusLabel =
            hrsOver > 0
              ? `Overdue by ${hrsOver}h ${minsOver}m`
              : `Overdue by ${minsOver}m`;
        } else {
          status = "upcoming";
          const hrsUntil = Math.floor(minutesDiff / 60);
          const minsUntil = minutesDiff % 60;
          statusLabel =
            hrsUntil > 0
              ? `Upcoming in ${hrsUntil}h ${minsUntil}m`
              : `Upcoming in ${minsUntil}m`;
        }

        items.push({
          doseId,
          medId: med.id,
          medName: med.name,
          medNote: med.note,
          scheduledTime: rawTime,
          effectiveTime,
          adherenceKey,
          taken,
          status,
          minutesDiff,
          statusLabel,
        });
      }
    }

    return items.sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
  }, [
    medicines,
    todayStr,
    currentMinutesOfDay,
    nowDate,
    snoozedUntilMap,
    simulatedDueOverrides,
  ]);

  // Active due/overdue alerts that haven't been taken or dismissed
  const activeMedicationAlerts = useMemo(() => {
    return scheduledDosesToday.filter(
      (d) =>
        (d.status === "due_now" || d.status === "overdue") &&
        !d.taken &&
        !dismissedDoseKeys[d.doseId]
    );
  }, [scheduledDosesToday, dismissedDoseKeys]);

  // Trigger browser Notification & gentle chime when a new dose transitions into due_now / overdue
  useEffect(() => {
    let triggeredNew = false;
    for (const alertItem of activeMedicationAlerts) {
      if (!notifiedDoseKeysRef.current.has(alertItem.doseId)) {
        notifiedDoseKeysRef.current.add(alertItem.doseId);
        triggeredNew = true;

        if (
          typeof window !== "undefined" &&
          "Notification" in window &&
          Notification.permission === "granted"
        ) {
          try {
            new Notification(`Medicine Reminder: ${alertItem.medName}`, {
              body: `${alertItem.statusLabel} — ${alertItem.medNote} (${profile.customName})`,
            });
          } catch {
            // In-app alert banner handles fallback
          }
        }
      }
    }
    if (triggeredNew) {
      playGentleReminderChime();
    }
  }, [activeMedicationAlerts, profile.customName]);

  const handleSnoozeDose = (doseId: string, minutes = 15) => {
    setSnoozedUntilMap((prev) => ({
      ...prev,
      [doseId]: Date.now() + minutes * 60_000,
    }));
    // Allow re-notification when snooze expires
    notifiedDoseKeysRef.current.delete(doseId);
    setNotifFeedback(`Snoozed reminder for ${minutes} minutes.`);
  };

  const handleDismissDoseAlert = (doseId: string) => {
    setDismissedDoseKeys((prev) => ({ ...prev, [doseId]: true }));
  };

  const handleTriggerNextDoseTest = () => {
    const candidate =
      scheduledDosesToday.find((d) => !d.taken) || scheduledDosesToday[0];
    if (!candidate) {
      setNotifFeedback("Add a medicine below first to test schedule alerts.");
      return;
    }
    // If already taken today, untake it so the user sees the live due-now notification card
    if (candidate.taken) {
      onToggleMedicineTaken(candidate.medId, candidate.adherenceKey);
    }
    setDismissedDoseKeys((prev) => {
      const next = { ...prev };
      delete next[candidate.doseId];
      return next;
    });
    setSnoozedUntilMap((prev) => {
      const next = { ...prev };
      delete next[candidate.doseId];
      return next;
    });
    notifiedDoseKeysRef.current.delete(candidate.doseId);
    setSimulatedDueOverrides((prev) => ({
      ...prev,
      [candidate.doseId]: currentTimeFormatted,
    }));
    setNowDate(new Date());
    playGentleReminderChime();
    setNotifFeedback(
      `Triggered live schedule alert for "${candidate.medName}" (${candidate.scheduledTime}).`
    );
  };

  const takenCountToday = scheduledDosesToday.filter((d) => d.taken).length;
  const totalDosesToday = scheduledDosesToday.length;
  const adherencePctToday =
    totalDosesToday > 0
      ? Math.round((takenCountToday / totalDosesToday) * 100)
      : 100;

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
          Daily Log, Real-Time Wearable Sync & Medicine Reminders
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Active profile: {profile.customName} · Large inputs, one-tap context, and continuous smartwatch synchronization.
        </p>
      </div>

      {/* Live Scheduled Medication Due-Now Alert Banner */}
      {activeMedicationAlerts.length > 0 && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-xl border-2 border-teal-600/80 dark:border-teal-500 bg-teal-50/90 dark:bg-teal-950/60 p-4 md:p-5 space-y-3 shadow-xs"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-teal-700 text-white flex items-center justify-center shrink-0">
                <BellRing className="w-4 h-4 animate-bounce" />
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-teal-800 dark:text-teal-300">
                  Scheduled Medication Reminder · {profile.customName}
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300">
                  It is time to take {activeMedicationAlerts.length}{" "}
                  {activeMedicationAlerts.length === 1
                    ? "scheduled medicine"
                    : "scheduled medicines"}{" "}
                  based on your daily schedule.
                </p>
              </div>
            </div>
            <span className="font-mono text-xs font-semibold text-teal-800 dark:text-teal-300 tabular-nums">
              Local Time: {currentTimeFormatted}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {activeMedicationAlerts.map((item) => (
              <div
                key={item.doseId}
                className="p-3.5 rounded-lg border border-teal-200 dark:border-teal-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {item.medName}
                    </span>
                    <span
                      className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded ${
                        item.status === "overdue"
                          ? "bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300"
                          : "bg-teal-100 dark:bg-teal-950/70 text-teal-900 dark:text-teal-300"
                      }`}
                    >
                      {item.statusLabel}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {item.medNote} · Scheduled for {item.scheduledTime}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      onToggleMedicineTaken(item.medId, item.adherenceKey);
                      setSimulatedDueOverrides((prev) => {
                        const next = { ...prev };
                        delete next[item.doseId];
                        return next;
                      });
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Mark Taken</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSnoozeDose(item.doseId, 15)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <Clock className="w-3.5 h-3.5 text-teal-700" />
                    <span>Snooze 15m</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDismissDoseAlert(item.doseId)}
                    aria-label="Dismiss reminder alert"
                    className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3-Consecutive Entry Upward Trend Monitor & Custom Push Alerts */}
      <TrendAlertCenter
        mode="daily_log"
        alerts={dailyLogTrendAlerts}
        config={trendAlertConfig}
        onUpdateConfig={(cfg) => onUpdateTrendAlertConfig?.(cfg)}
        onSimulateThreeEntryTrend={() => onSimulateLogTrend?.()}
      />

      {/* Real-Time Wearable Synchronization Hub */}
      <WearableHub profileId={profile.id} onSyncReadings={onAddReadings} />

      {/* Quick Entry Cards (Glucose, Blood Pressure, Weight) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Glucose Quick Card */}
        <form
          onSubmit={handleLogGlucose}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between space-y-4"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Log Blood Sugar (mg/dL)
              </h2>
              <span className="text-xs font-mono text-teal-700 dark:text-teal-400 tabular-nums">
                {glucoseInRangePct}% in range
              </span>
            </div>

            <input
              type="number"
              value={glucoseVal}
              onChange={(e) => setGlucoseVal(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100"
            />

            <div className="grid grid-cols-3 gap-1.5">
              {(["fasting", "after meal", "random"] as ReadingContext[]).map((ctx) => (
                <button
                  key={ctx}
                  type="button"
                  onClick={() => setGlucoseContext(ctx)}
                  className={`py-1.5 text-xs font-medium rounded-lg border capitalize ${
                    glucoseContext === ctx
                      ? "border-teal-700 bg-teal-50 dark:bg-teal-950/50 text-teal-900 dark:text-teal-200"
                      : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {ctx}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors"
          >
            Save Glucose Reading
          </button>
        </form>

        {/* Blood Pressure Quick Card */}
        <form
          onSubmit={handleLogBp}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between space-y-4"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Log Blood Pressure (mmHg)
              </h2>
              <span className="text-xs font-mono text-teal-700 dark:text-teal-400 tabular-nums">
                {bpInRangePct}% &lt;135/85
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] text-slate-500 mb-0.5">
                  Systolic
                </label>
                <input
                  type="number"
                  value={sysVal}
                  onChange={(e) => setSysVal(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-xl font-bold font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 mb-0.5">
                  Diastolic
                </label>
                <input
                  type="number"
                  value={diaVal}
                  onChange={(e) => setDiaVal(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-xl font-bold font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 mb-0.5">
                  Pulse
                </label>
                <input
                  type="number"
                  value={pulseVal}
                  onChange={(e) => setPulseVal(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-xl font-bold font-mono tabular-nums"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              {(["morning", "evening"] as ReadingContext[]).map((ctx) => (
                <button
                  key={ctx}
                  type="button"
                  onClick={() => setBpContext(ctx)}
                  className={`py-1.5 text-xs font-medium rounded-lg border capitalize ${
                    bpContext === ctx
                      ? "border-teal-700 bg-teal-50 dark:bg-teal-950/50 text-teal-900 dark:text-teal-200"
                      : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {ctx}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors"
          >
            Save BP Reading
          </button>
        </form>

        {/* Weight & Weekly Summary Card */}
        <form
          onSubmit={handleLogWeight}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 flex flex-col justify-between space-y-4"
        >
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Log Morning Weight (kg)
            </h2>
            <input
              type="number"
              step="0.1"
              value={weightVal}
              onChange={(e) => setWeightVal(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3 text-2xl font-bold font-mono tabular-nums"
            />
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-600 dark:text-slate-300 space-y-1">
              <div className="font-semibold text-slate-900 dark:text-slate-100">
                Weekly Log Summary:
              </div>
              <div className="tabular-nums">
                {glucoseReadings.length} sugar logs ({glucoseInRangePct}% in target) ·{" "}
                {bpReadings.length} BP logs ({bpInRangePct}% in target)
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors"
          >
            Save Weight Reading
          </button>
        </form>
      </div>

      {/* Trend Charts with Text Alternatives */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-teal-700" />
              <span>Blood Glucose Trend (mg/dL)</span>
            </h3>
            <span className="text-xs text-slate-500 tabular-nums">
              {glucoseInRangePct}% in range
            </span>
          </div>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={glucoseReadings.map((r) => ({
                  date: r.time.slice(5, 10),
                  mgDl: r.value,
                  context: r.context,
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis domain={[60, 240]} tick={{ fontSize: 11 }} width={35} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="mgDl"
                  stroke="#0D9488"
                  strokeWidth={2.5}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-slate-500">
            Text alternative: {glucoseReadings.length} glucose readings recorded; latest is{" "}
            {glucoseReadings[glucoseReadings.length - 1]?.value ?? "—"} mg/dL (
            {glucoseReadings[glucoseReadings.length - 1]?.context ?? "fasting"}).
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-teal-700" />
              <span>Blood Pressure Trend (Systolic & Diastolic mmHg)</span>
            </h3>
            <span className="text-xs text-slate-500 tabular-nums">
              {bpInRangePct}% in target
            </span>
          </div>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={bpReadings.map((r) => ({
                  date: r.time.slice(5, 10),
                  Systolic: r.value,
                  Diastolic: r.secondaryValue ?? 80,
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis domain={[60, 180]} tick={{ fontSize: 11 }} width={35} />
                <Tooltip />
                <Line type="monotone" dataKey="Systolic" stroke="#0D9488" strokeWidth={2.5} />
                <Line type="monotone" dataKey="Diastolic" stroke="#64748B" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-slate-500">
            Text alternative: {bpReadings.length} blood pressure readings recorded; latest is{" "}
            {bpReadings[bpReadings.length - 1]?.value ?? "—"}/
            {bpReadings[bpReadings.length - 1]?.secondaryValue ?? "—"} mmHg.
          </p>
        </div>
      </div>

      {/* Medicines & Reminders + Appointment Schedule */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-teal-700 dark:text-teal-400">
                <Pill className="w-4 h-4" />
                <span>Real-Time Medication Schedule & Adherence Notification Engine</span>
              </div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                Medicines & Scheduled Reminder Alerts
              </h2>
              <p className="text-xs text-slate-500">
                User-entered text only. Milo never suggests drug names, doses, or changes to your prescription.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setChimeEnabled((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                title="Toggle gentle reminder bell chime"
              >
                {chimeEnabled ? (
                  <Volume2 className="w-3.5 h-3.5 text-teal-700" />
                ) : (
                  <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                )}
                <span>{chimeEnabled ? "Chime On" : "Muted"}</span>
              </button>

              <button
                type="button"
                onClick={handleTriggerNextDoseTest}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-800 dark:text-teal-200 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 hover:bg-teal-100 rounded-lg transition-colors whitespace-nowrap"
              >
                <BellRing className="w-3.5 h-3.5 text-teal-700 dark:text-teal-300" />
                <span>Simulate Dose Due Now</span>
              </button>

              <button
                type="button"
                onClick={handleRequestNotifications}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg whitespace-nowrap"
              >
                <Bell className="w-3.5 h-3.5 text-teal-700" />
                <span>
                  {notificationsEnabled ? "Push Active" : "Enable Browser Push"}
                </span>
              </button>
            </div>
          </div>

          {/* Daily Adherence & Live Clock Status Bar */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Today&apos;s Schedule ({todayStr} · {currentTimeFormatted})
                </span>
              </div>
              <span className="font-mono font-semibold text-teal-800 dark:text-teal-300 tabular-nums">
                {takenCountToday} of {totalDosesToday} doses taken ({adherencePctToday}%)
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <div
                className="h-full bg-teal-600 transition-all duration-300"
                style={{ width: `${adherencePctToday}%` }}
              />
            </div>
          </div>

          {notifFeedback && (
            <p className="text-xs font-medium text-teal-700 dark:text-teal-400">
              {notifFeedback}
            </p>
          )}

          {/* Medicine Reminder Cards with Real-Time Schedule Status */}
          <div className="space-y-3">
            {medicines.map((med) => {
              const medDoses = scheduledDosesToday.filter(
                (d) => d.medId === med.id
              );
              const hasDueOrOverdue = medDoses.some(
                (d) => d.status === "due_now" || d.status === "overdue"
              );

              return (
                <div
                  key={med.id}
                  className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                    hasDueOrOverdue
                      ? "border-teal-500/80 dark:border-teal-600 bg-teal-50/30 dark:bg-teal-950/20"
                      : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30"
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {med.name}
                      </span>
                      {medDoses.map((d) => (
                        <span
                          key={d.doseId}
                          className={`inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md ${
                            d.status === "taken"
                              ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300"
                              : d.status === "due_now"
                                ? "bg-teal-100 dark:bg-teal-950/80 text-teal-900 dark:text-teal-200 font-semibold"
                                : d.status === "overdue"
                                  ? "bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 font-semibold"
                                  : d.status === "snoozed"
                                    ? "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          {d.status === "overdue" && (
                            <AlertCircle className="w-3 h-3 text-amber-600" />
                          )}
                          <span>{d.statusLabel}</span>
                        </span>
                      ))}
                    </div>
                    <p className="text-xs text-slate-500">{med.note}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {med.times.map((t) => {
                      const key = `${todayStr}_${t}`;
                      const doseId = `${med.id}_${key}`;
                      const taken = Boolean(med.adherenceLog?.[key]);
                      return (
                        <div key={t} className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              onToggleMedicineTaken(med.id, key);
                              setSimulatedDueOverrides((prev) => {
                                const next = { ...prev };
                                delete next[doseId];
                                return next;
                              });
                            }}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors tabular-nums ${
                              taken
                                ? "border-emerald-600 bg-emerald-600 text-white"
                                : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-teal-600"
                            }`}
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>
                              {t} {taken ? "Taken" : "Mark Taken"}
                            </span>
                          </button>
                          {!taken && (
                            <button
                              type="button"
                              onClick={() => handleSnoozeDose(doseId, 15)}
                              title={`Snooze ${t} reminder for 15 minutes`}
                              className="px-2 py-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                            >
                              +15m
                            </button>
                          )}
                        </div>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => onDeleteMedicine(med.id)}
                      aria-label={`Remove ${med.name}`}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add Medicine Form (Supports 1 or 2 daily reminder times) */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!medName.trim()) return;
              const timesList = Array.from(
                new Set(
                  [medTime, medSecondTime]
                    .map((t) => t.trim())
                    .filter(Boolean)
                )
              ).sort();
              onAddMedicine({
                profileId: profile.id,
                name: medName.trim(),
                note: medNote.trim() || "Entered by user",
                times: timesList.length > 0 ? timesList : ["08:30"],
                active: true,
              });
              setMedName("");
              setMedNote("");
              setMedSecondTime("");
              setNotifFeedback(
                `Added "${medName.trim()}" to daily reminder schedule (${timesList.join(", ")}).`
              );
            }}
            className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5"
          >
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Add Prescribed Medicine to Daily Notification Schedule
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <input
                type="text"
                value={medName}
                onChange={(e) => setMedName(e.target.value)}
                placeholder="Medicine label (from your doctor's prescription)"
                className="sm:col-span-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
              />
              <input
                type="text"
                value={medNote}
                onChange={(e) => setMedNote(e.target.value)}
                placeholder="Note (e.g. after breakfast)"
                className="sm:col-span-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
              />
              <input
                type="time"
                aria-label="Primary reminder time"
                value={medTime}
                onChange={(e) => setMedTime(e.target.value)}
                className="sm:col-span-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-2 text-xs font-mono"
              />
              <input
                type="time"
                aria-label="Optional second reminder time"
                value={medSecondTime}
                onChange={(e) => setMedSecondTime(e.target.value)}
                title="Optional second daily dose time (e.g. evening)"
                className="sm:col-span-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-2 text-xs font-mono"
              />
              <button
                type="submit"
                aria-label="Add medicine reminder"
                className="sm:col-span-1 inline-flex items-center justify-center p-2 text-white bg-teal-700 hover:bg-teal-800 rounded-lg"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>

        {/* Upcoming Doctor & Lab Appointments */}
        <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-teal-700 dark:text-teal-400">
            <Calendar className="w-4 h-4" />
            <span>Follow-up Appointments & Lab Re-check Schedule</span>
          </div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Scheduled Visits
          </h3>

          <div className="space-y-2.5">
            {appointments.map((a) => (
              <div
                key={a.id}
                className="p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30 space-y-1"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {a.title}
                  </span>
                  <span className="font-mono text-teal-700 dark:text-teal-400 tabular-nums">
                    {a.date} · {a.time}
                  </span>
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400">
                  {a.doctorOrLab}
                </div>
              </div>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!apptTitle.trim()) return;
              onAddAppointment({
                profileId: profile.id,
                title: apptTitle.trim(),
                doctorOrLab: apptDoctor.trim() || "Clinic / Diagnostic Lab",
                date: apptDate,
                time: apptTime,
                notes: "",
              });
              setApptTitle("");
              setApptDoctor("");
            }}
            className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5"
          >
            <input
              type="text"
              value={apptTitle}
              onChange={(e) => setApptTitle(e.target.value)}
              placeholder="Visit title (e.g. Repeat HbA1c & Eye Check)"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
            />
            <input
              type="text"
              value={apptDoctor}
              onChange={(e) => setApptDoctor(e.target.value)}
              placeholder="Doctor or lab name"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={apptDate}
                onChange={(e) => setApptDate(e.target.value)}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono"
              />
              <input
                type="time"
                value={apptTime}
                onChange={(e) => setApptTime(e.target.value)}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-mono"
              />
            </div>
            <button
              type="submit"
              className="w-full py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 rounded-lg"
            >
              Add Appointment Reminder
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
