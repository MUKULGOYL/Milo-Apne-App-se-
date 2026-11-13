import React from "react";
import { ShieldCheck, Lock, EyeOff } from "lucide-react";
import { TranslationDict } from "../i18n/en";

export function ConsentModal({
  open,
  dict,
  onAccept,
  onCancel,
}: {
  open: boolean;
  dict: TranslationDict;
  onAccept: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 backdrop-blur-xs p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-xl rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 md:p-8 shadow-xl"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-teal-50 dark:bg-teal-950/60 flex items-center justify-center text-teal-700 dark:text-teal-300">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {dict.consent.title}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Aware, not afraid · Privacy-first health literacy
            </p>
          </div>
        </div>

        <div className="space-y-3.5 text-sm text-slate-700 dark:text-slate-300 my-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0 mt-1" />
            <p>{dict.consent.point1}</p>
          </div>
          <div className="flex items-start gap-3">
            <Lock className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0 mt-1" />
            <p>{dict.consent.point2}</p>
          </div>
          <div className="flex items-start gap-3">
            <EyeOff className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0 mt-1" />
            <p>{dict.consent.point3}</p>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-3.5 text-xs text-slate-600 dark:text-slate-300">
            {dict.consent.redactionNote}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            {dict.consent.cancelButton}
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="px-5 py-2.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            {dict.consent.acceptButton}
          </button>
        </div>
      </div>
    </div>
  );
}
