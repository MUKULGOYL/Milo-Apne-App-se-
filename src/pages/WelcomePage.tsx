import React from "react";
import {
  ArrowRight,
  ClipboardCheck,
  FileSpreadsheet,
  FileUp,
  HeartHandshake,
  ShieldCheck,
  Sliders,
} from "lucide-react";
import { CareMapsAgent } from "../components/CareMapsAgent";
import { VideoAnimatorStudio } from "../components/VideoAnimatorStudio";
import { TranslationDict } from "../i18n/en";
import { SAMPLE_REPORTS, SampleReportPreset } from "../lib/extract";
import { SupportedLanguage } from "../lib/i18n";
import { Profile, Report } from "../lib/storage";

export function WelcomePage({
  dict,
  language,
  activeProfile,
  latestReport,
  onStartUpload,
  onOpenPrevention,
  onLoadSamplePreset,
  onOpenResults,
  onOpenDailyLog,
}: {
  dict: TranslationDict;
  language: SupportedLanguage;
  activeProfile: Profile;
  latestReport: Report | null;
  onStartUpload: (initialMode?: "upload" | "scan" | "manual") => void;
  onOpenPrevention: () => void;
  onLoadSamplePreset: (preset: SampleReportPreset) => void;
  onOpenResults: () => void;
  onOpenDailyLog: () => void;
}) {
  return (
    <div className="space-y-12 pb-12">
      {/* Hero Section (Split 12-Column Editorial Clinical Layout) */}
      <section className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 md:p-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-teal-800 dark:text-teal-300 font-medium">
                <span>{dict.appName}</span>
                <span aria-hidden="true">·</span>
                <span>{dict.tagline}</span>
                <span aria-hidden="true">·</span>
                <span>{dict.heroSubtitle}</span>
              </div>

              <h1 className="font-display text-3xl sm:text-4xl lg:text-[42px] font-bold tracking-tight text-slate-900 dark:text-slate-50 leading-[1.15]">
                {dict.heroTitle}
              </h1>

              <p className="text-base text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
                {dict.heroLead}
              </p>
            </div>

            {/* Primary CTAs */}
            <div className="space-y-3 pt-2">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => onStartUpload("upload")}
                  className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-xl transition-colors whitespace-nowrap shrink-0"
                >
                  <FileUp className="w-4 h-4" />
                  <span>{dict.ctas.uploadReport}</span>
                </button>

                <button
                  type="button"
                  onClick={onOpenPrevention}
                  className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors whitespace-nowrap shrink-0"
                >
                  <ClipboardCheck className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                  <span>{dict.ctas.checkRisk}</span>
                </button>

                <button
                  type="button"
                  onClick={() => onLoadSamplePreset(SAMPLE_REPORTS[0])}
                  className="inline-flex items-center gap-2 px-4 py-3 text-sm font-medium text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800 hover:bg-teal-50/60 dark:hover:bg-teal-950/40 rounded-xl transition-colors whitespace-nowrap shrink-0"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>{dict.ctas.trySample}</span>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                <span>Active Profile: {activeProfile.customName}</span>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={() => onStartUpload("scan")}
                  className="underline hover:text-teal-700"
                >
                  {dict.ctas.scanReading}
                </button>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={() => onStartUpload("manual")}
                  className="underline hover:text-teal-700"
                >
                  {dict.ctas.manualEntry}
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Active Profile Snapshot & Sample Report Switcher */}
          <div className="lg:col-span-5 flex flex-col justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-[#FAF9F6] dark:bg-slate-800/50 p-5 space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pb-3 border-b border-slate-200 dark:border-slate-700">
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  Instant Sample Reports (Clearly Marked)
                </span>
                <span>1-Tap Review & Engine</span>
              </div>

              <div className="space-y-2.5 mt-3">
                {SAMPLE_REPORTS.map((preset) => (
                  <div
                    key={preset.id}
                    className="p-3 rounded-lg border border-slate-200/90 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-[11px] font-mono text-teal-700 dark:text-teal-400">
                        {preset.badge} · {preset.reportDate}
                      </div>
                      <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {preset.title}
                      </div>
                      <div className="text-[11px] text-slate-500 line-clamp-1">
                        {preset.subtitle}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onLoadSamplePreset(preset)}
                      className="px-3 py-1.5 text-xs font-semibold text-teal-800 dark:text-teal-200 bg-teal-50 dark:bg-teal-950/60 hover:bg-teal-100 rounded-lg whitespace-nowrap shrink-0"
                    >
                      Review Sample
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {latestReport && (
              <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
                <div className="text-xs text-slate-600 dark:text-slate-300">
                  <span className="font-semibold">Latest loaded report:</span>{" "}
                  {latestReport.date} ({latestReport.values.length} markers)
                </div>
                <button
                  type="button"
                  onClick={onOpenResults}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline whitespace-nowrap shrink-0"
                >
                  <span>View Results</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 3 Value Points Strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8 pt-8 border-t border-slate-200 dark:border-slate-800">
          {dict.valuePoints.map((vp, i) => {
            const Icons = [ShieldCheck, HeartHandshake, Sliders];
            const Icon = Icons[i % Icons.length];
            return (
              <div key={i} className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  <Icon className="w-4 h-4 text-teal-700 dark:text-teal-400 shrink-0" />
                  <span>
                    0{i + 1}. {vp.title}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {vp.body}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Real-Time Google Maps Platform & Grounded Places Agent Section */}
      <section aria-label="Google Maps Care & Walking Route Finder">
        <CareMapsAgent language={language} />
      </section>

      {/* Animate Images into Video with Gemini Omni Flash Section */}
      <section aria-label="Animate Images into Video with Gemini Omni Flash">
        <VideoAnimatorStudio />
      </section>
    </div>
  );
}
