import React from "react";
import { AlertTriangle, CheckCircle2, Info, ShieldAlert, X } from "lucide-react";

/**
 * Clean, bright, global-standard UI design system for Milo.
 * Adheres strictly to:
 * - Zero-pill metadata discipline (unboxed text with `·` separators)
 * - No thick left borders (`border-l-4` banned)
 * - Single-elevation cards (`border border-slate-200/80 bg-white dark:bg-slate-900 dark:border-slate-800`)
 * - Tabular numerals (`tabular-nums`) for all clinical figures
 * - Explicit text + icon state signaling (never color alone)
 */

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 ${className}`}
    >
      {children}
    </div>
  );
}

export function StatusBadge({
  tone,
  children,
}: {
  tone: "normal" | "borderline" | "high" | "info";
  children: React.ReactNode;
}) {
  const styles: Record<typeof tone, string> = {
    normal:
      "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    borderline:
      "bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    high:
      "bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800",
    info:
      "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700",
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-md border text-[11px] font-semibold ${styles[tone]}`}
    >
      {children}
    </span>
  );
}

export function SectionHeader({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        {icon && <span className="text-teal-700 dark:text-teal-400">{icon}</span>}
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
      </div>
      {subtitle && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>
      )}
    </div>
  );
}

export function StatusIndicator({
  status,
  label,
}: {
  status: "normal" | "borderline" | "elevated" | "high" | "low" | "urgent" | "info";
  label: string;
}) {
  const styles: Record<typeof status, { text: string; Icon: React.ComponentType<any> }> = {
    normal: {
      text: "text-emerald-700 dark:text-emerald-400",
      Icon: CheckCircle2,
    },
    borderline: {
      text: "text-amber-700 dark:text-amber-400",
      Icon: Info,
    },
    elevated: {
      text: "text-amber-800 dark:text-amber-300",
      Icon: AlertTriangle,
    },
    high: {
      text: "text-rose-700 dark:text-rose-400",
      Icon: AlertTriangle,
    },
    low: {
      text: "text-sky-700 dark:text-sky-400",
      Icon: Info,
    },
    urgent: {
      text: "text-red-700 dark:text-red-400 font-semibold",
      Icon: ShieldAlert,
    },
    info: {
      text: "text-slate-600 dark:text-slate-400",
      Icon: Info,
    },
  };

  const { text, Icon } = styles[status] || styles.info;

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${text}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

export function UrgentSafetyBanner({
  title,
  subtitle,
  alerts,
  onLocateCare,
}: {
  title: string;
  subtitle: string;
  alerts: { testName: string; value: string; reason: string }[];
  onLocateCare?: () => void;
}) {
  if (!alerts || alerts.length === 0) return null;

  return (
    <div
      role="alert"
      className="mb-6 rounded-xl border border-red-300 bg-red-50/90 dark:bg-red-950/50 dark:border-red-800 p-5 text-red-950 dark:text-red-100"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <ShieldAlert className="w-6 h-6 text-red-700 dark:text-red-400 shrink-0 mt-0.5" />
          <div>
            <h2 className="text-base font-semibold text-red-950 dark:text-red-100">
              {title}
            </h2>
            <p className="text-sm text-red-800 dark:text-red-200 mt-0.5">
              {subtitle}
            </p>
            <ul className="mt-2.5 space-y-1 text-xs text-red-900 dark:text-red-200">
              {alerts.map((a, idx) => (
                <li key={idx} className="tabular-nums">
                  <span className="font-semibold">{a.testName}: {a.value}</span>
                  <span aria-hidden="true"> · </span>
                  <span>{a.reason}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        {onLocateCare && (
          <button
            type="button"
            onClick={onLocateCare}
            className="px-4 py-2 text-xs font-semibold text-white bg-red-700 hover:bg-red-800 rounded-lg transition-colors whitespace-nowrap shrink-0 self-start md:self-center"
          >
            Find Nearby Clinic / Hospital
          </button>
        )}
      </div>
    </div>
  );
}

export function SegmentedTabs<T extends string>({
  tabs,
  activeTab,
  onChange,
}: {
  tabs: { id: T; label: string }[];
  activeTab: T;
  onChange: (id: T) => void;
}) {
  return (
    <div
      role="tablist"
      className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/90 rounded-lg overflow-x-auto max-w-full"
    >
      {tabs.map((tab) => {
        const active = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              active
                ? "bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-300 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export function DrawerModal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl"
      >
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="pt-5">{children}</div>
      </div>
    </div>
  );
}
