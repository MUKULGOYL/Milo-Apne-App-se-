import React, { useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  FileText,
  FileUp,
  Plus,
  RefreshCw,
  ScanLine,
  Trash2,
} from "lucide-react";
import { TranslationDict } from "../i18n/en";
import {
  DocumentType,
  mergeAndNormalizeExtraction,
  SampleReportPreset,
} from "../lib/extract";
import { callAExtractPage, callBVerifyPage } from "../lib/gemini";
import {
  CANONICAL_TESTS,
  CanonicalTestName,
  normalizeExtractedTests,
  normalizeIndianDate,
  NormalizedTestValue,
  resolveCanonicalName,
} from "../lib/normalize";
import { MAX_PAGES, ProcessedPageImage, processImageFile } from "../lib/ocr";
import { processPdfFile } from "../lib/pdf";

export function AddReportAndReviewPage({
  dict,
  initialMode = "upload",
  initialPreset = null,
  consentAccepted,
  onRequireConsent,
  onCompleteReview,
}: {
  dict: TranslationDict;
  initialMode?: "upload" | "scan" | "manual";
  initialPreset?: SampleReportPreset | null;
  consentAccepted: boolean;
  onRequireConsent: (onAcceptedCallback: () => void) => void;
  onCompleteReview: (payload: {
    reportDate: string;
    labName: string;
    documentType: DocumentType;
    isSample: boolean;
    pathologyTerms: { term: string; contextAsPrinted: string }[];
    confirmedValues: NormalizedTestValue[];
  }) => Promise<void>;
}) {
  const [mode, setMode] = useState<"upload" | "scan" | "manual">(initialMode);
  const [pages, setPages] = useState<ProcessedPageImage[]>([]);
  const [processingFiles, setProcessingFiles] = useState(false);
  const [extractingAi, setExtractingAi] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Review state
  const [inReviewStep, setInReviewStep] = useState<boolean>(Boolean(initialPreset));
  const [isSampleReport, setIsSampleReport] = useState<boolean>(Boolean(initialPreset));
  const [reportDate, setReportDate] = useState<string>(
    initialPreset ? normalizeIndianDate(initialPreset.reportDate) : new Date().toISOString().slice(0, 10)
  );
  const [labName, setLabName] = useState<string>(
    initialPreset ? initialPreset.labName : "Diagnostic Laboratory"
  );
  const [documentType, setDocumentType] = useState<DocumentType>(
    initialPreset ? initialPreset.documentType : "blood"
  );
  const [pathologyTerms, setPathologyTerms] = useState<
    { term: string; contextAsPrinted: string }[]
  >(initialPreset?.pathologyTerms || []);
  const [rows, setRows] = useState<NormalizedTestValue[]>(() =>
    initialPreset ? normalizeExtractedTests(initialPreset.rawTests) : []
  );
  const [analysingReport, setAnalysingReport] = useState(false);

  // Camera capture modal state
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Handle adding files (PDF, JPG, PNG, WEBP, HEIC)
  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const proceed = async () => {
      setProcessingFiles(true);
      setErrorMessage(null);
      try {
        const nextPages: ProcessedPageImage[] = [...pages];
        for (let i = 0; i < fileList.length; i++) {
          if (nextPages.length >= MAX_PAGES) {
            setErrorMessage(`Maximum ${MAX_PAGES} pages reached.`);
            break;
          }
          const file = fileList[i];
          const isPdf =
            file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
          if (isPdf) {
            const pdfPages = await processPdfFile(file, nextPages.length + 1);
            nextPages.push(...pdfPages);
          } else {
            const imgPage = await processImageFile(file, nextPages.length + 1);
            nextPages.push(imgPage);
          }
        }
        // Re-index page numbers cleanly
        setPages(
          nextPages.slice(0, MAX_PAGES).map((p, idx) => ({ ...p, pageNumber: idx + 1 }))
        );
      } catch (err: any) {
        setErrorMessage(err?.message || "Could not process uploaded file.");
      } finally {
        setProcessingFiles(false);
      }
    };

    if (!consentAccepted) {
      onRequireConsent(proceed);
    } else {
      await proceed();
    }
  };

  const handleMovePage = (idx: number, direction: -1 | 1) => {
    const target = idx + direction;
    if (target < 0 || target >= pages.length) return;
    const copy = [...pages];
    const [item] = copy.splice(idx, 1);
    copy.splice(target, 0, item);
    setPages(copy.map((p, i) => ({ ...p, pageNumber: i + 1 })));
  };

  const handleRemovePage = (id: string) => {
    setPages((prev) =>
      prev
        .filter((p) => p.id !== id)
        .map((p, i) => ({ ...p, pageNumber: i + 1 }))
    );
  };

  // Start live camera capture
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      setCameraActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch {
      setErrorMessage(
        "Camera access was unavailable or blocked by the browser. Please use the Upload Photo button to select a photo from your device."
      );
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const captureCameraFrame = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      async (blob) => {
        if (!blob) return;
        const file = new File([blob], `camera-capture-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        stopCamera();
        const dt = new DataTransfer();
        dt.items.add(file);
        await handleFilesSelected(dt.files);
      },
      "image/jpeg",
      0.9
    );
  };

  // Run AI Orchestration Call A (Extract) + Call B (Verify) + Code step C (Normalize)
  const handleRunExtractionPipeline = async () => {
    if (pages.length === 0) return;
    setExtractingAi(true);
    setErrorMessage(null);

    try {
      const callAResults = [];
      const callBResults = [];

      for (const page of pages) {
        const resA = await callAExtractPage(
          page,
          mode === "scan" ? "monitor" : "report"
        );
        callAResults.push(resA);

        const resB = await callBVerifyPage(page, resA);
        callBResults.push(resB);
      }

      const merged = mergeAndNormalizeExtraction(callAResults, callBResults);
      setReportDate(merged.reportDate);
      setLabName(
        mode === "scan" ? "Home Monitor Reading (BP / Glucometer)" : merged.labName
      );
      setDocumentType(mode === "scan" ? "BP-reading" : merged.documentType);
      setPathologyTerms(merged.pathologyTerms);
      setRows(merged.normalizedValues);
      setIsSampleReport(false);
      setInReviewStep(true);
    } catch (err: any) {
      setErrorMessage(
        err?.message ||
          "Extraction timed out or encountered an error. You can tap Retry or enter values manually."
      );
    } finally {
      setExtractingAi(false);
    }
  };

  // Switch directly to Manual Entry with starter rows
  const handleStartManualEntry = () => {
    setMode("manual");
    setIsSampleReport(false);
    if (rows.length === 0) {
      setRows(
        normalizeExtractedTests([
          {
            canonicalName: "hba1c",
            nameAsPrinted: "HbA1c",
            value: 6.2,
            unit: "%",
            refLow: 4.0,
            refHigh: 5.6,
            confidence: 1.0,
            page: 1,
          },
          {
            canonicalName: "fasting_glucose",
            nameAsPrinted: "Fasting Blood Sugar (FBS)",
            value: 114,
            unit: "mg/dL",
            refLow: 70,
            refHigh: 99,
            confidence: 1.0,
            page: 1,
          },
          {
            canonicalName: "systolic_bp",
            nameAsPrinted: "Systolic Blood Pressure",
            value: 132,
            unit: "mmHg",
            refLow: 90,
            refHigh: 119,
            confidence: 1.0,
            page: 1,
          },
          {
            canonicalName: "diastolic_bp",
            nameAsPrinted: "Diastolic Blood Pressure",
            value: 84,
            unit: "mmHg",
            refLow: 60,
            refHigh: 79,
            confidence: 1.0,
            page: 1,
          },
          {
            canonicalName: "creatinine",
            nameAsPrinted: "Serum Creatinine",
            value: 0.95,
            unit: "mg/dL",
            refLow: 0.6,
            refHigh: 1.2,
            confidence: 1.0,
            page: 1,
          },
        ])
      );
    }
    setInReviewStep(true);
  };

  // Editable table handlers
  const handleUpdateRow = (
    id: string,
    field: "nameAsPrinted" | "value" | "unit" | "refLow" | "refHigh",
    rawVal: string
  ) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        if (field === "nameAsPrinted") {
          const canonical = resolveCanonicalName(rawVal);
          const meta = canonical !== "other" ? CANONICAL_TESTS[canonical] : undefined;
          return {
            ...row,
            nameAsPrinted: rawVal,
            canonicalName: canonical,
            displayName: meta ? meta.displayName : rawVal,
            unit: meta ? meta.standardUnit : row.unit,
          };
        }
        if (field === "unit") {
          return { ...row, unit: rawVal };
        }
        const num = rawVal === "" ? 0 : Number(rawVal);
        if (field === "value") {
          const meta =
            row.canonicalName !== "other" ? CANONICAL_TESTS[row.canonicalName] : undefined;
          const implausible =
            meta && (num < meta.plausibleMin || num > meta.plausibleMax)
              ? `Outside typical limits (${meta.plausibleMin}–${meta.plausibleMax} ${meta.standardUnit})`
              : undefined;
          return {
            ...row,
            value: num,
            plausibilityWarning: implausible,
          };
        }
        if (field === "refLow") {
          return { ...row, refLow: rawVal === "" ? null : num };
        }
        if (field === "refHigh") {
          return { ...row, refHigh: rawVal === "" ? null : num };
        }
        return row;
      })
    );
  };

  const handleConfirmRow = (id: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, confirmedByUser: true } : r))
    );
  };

  const handleConfirmAllRows = () => {
    setRows((prev) => prev.map((r) => ({ ...r, confirmedByUser: true })));
  };

  const handleAddBlankRow = () => {
    const newRow: NormalizedTestValue = {
      id: `manual-${Date.now()}`,
      canonicalName: "fasting_glucose",
      displayName: "Fasting Blood Sugar (FBS)",
      nameAsPrinted: "Fasting Blood Sugar",
      value: 100,
      unit: "mg/dL",
      refLow: 70,
      refHigh: 99,
      confidence: 1.0,
      page: 1,
      needsCheck: false,
      confirmedByUser: true,
    };
    setRows((prev) => [...prev, newRow]);
  };

  const handleDeleteRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  // Every flagged row (`needsCheck` or `!confirmedByUser`) must be confirmed before "Analyse" is enabled!
  const unconfirmedCount = rows.filter((r) => !r.confirmedByUser).length;
  const canAnalyse =
    (rows.length > 0 || documentType === "pathology/biopsy") &&
    unconfirmedCount === 0 &&
    !analysingReport;

  const handleFinalAnalyse = async () => {
    if (!canAnalyse) return;
    setAnalysingReport(true);
    setErrorMessage(null);
    try {
      await onCompleteReview({
        reportDate,
        labName,
        documentType,
        isSample: isSampleReport,
        pathologyTerms,
        confirmedValues: rows,
      });
    } catch (err: any) {
      setErrorMessage(err?.message || "Could not complete analysis. Please tap Retry.");
    } finally {
      setAnalysingReport(false);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Top Mode Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100">
            {inReviewStep
              ? "Review & Confirm Extracted Lab Values"
              : "Add a Lab Report or Scan a Monitor Reading"}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {inReviewStep
              ? "Mandatory safety check: verify every highlighted row against your printed report before Milo runs the deterministic engine."
              : "Supports Indian PDF/JPG/PNG/WEBP/HEIC reports up to 12 pages (15 MB each), BP/glucometer screen photos, or manual entry."}
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg self-start">
          <button
            type="button"
            onClick={() => {
              setMode("upload");
              setInReviewStep(false);
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              mode === "upload" && !inReviewStep
                ? "bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-300 shadow-xs"
                : "text-slate-600 dark:text-slate-400"
            }`}
          >
            Upload Report
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("scan");
              setInReviewStep(false);
            }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              mode === "scan" && !inReviewStep
                ? "bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-300 shadow-xs"
                : "text-slate-600 dark:text-slate-400"
            }`}
          >
            Scan BP / Glucometer
          </button>
          <button
            type="button"
            onClick={handleStartManualEntry}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              inReviewStep && mode === "manual"
                ? "bg-white dark:bg-slate-900 text-teal-800 dark:text-teal-300 shadow-xs"
                : "text-slate-600 dark:text-slate-400"
            }`}
          >
            Manual / Review Table
          </button>
        </div>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="rounded-xl border border-rose-300 bg-rose-50 dark:bg-rose-950/40 p-4 flex items-center justify-between gap-4 text-xs text-rose-900 dark:text-rose-200"
        >
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          {pages.length > 0 && !inReviewStep && (
            <button
              type="button"
              onClick={handleRunExtractionPipeline}
              className="px-3 py-1.5 font-semibold text-white bg-rose-700 hover:bg-rose-800 rounded-lg whitespace-nowrap shrink-0"
            >
              {dict.common.retry}
            </button>
          )}
        </div>
      )}

      {/* STEP 1: Upload / Scan / Camera Capture */}
      {!inReviewStep && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-6">
          <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-8 text-center space-y-4 bg-slate-50/50 dark:bg-slate-800/30">
            <div className="w-12 h-12 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 flex items-center justify-center mx-auto">
              {mode === "scan" ? (
                <ScanLine className="w-6 h-6" />
              ) : (
                <FileUp className="w-6 h-6" />
              )}
            </div>

            <div className="max-w-md mx-auto space-y-1">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {mode === "scan"
                  ? "Upload or take a photo of your BP monitor or glucometer screen"
                  : "Drop your PDF or lab report photos here (up to 12 pages)"}
              </h2>
              <p className="text-xs text-slate-500">
                Images are auto-oriented (EXIF), downscaled to 2000px for crisp OCR, and checked for sharpness before extraction.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                disabled={processingFiles}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <FileUp className="w-4 h-4" />
                <span>
                  {processingFiles ? "Processing pages..." : "Select PDF or Images"}
                </span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,image/jpeg,image/png,image/webp,image/heic"
                onChange={(e) => handleFilesSelected(e.target.files)}
                className="hidden"
              />

              <button
                type="button"
                onClick={startCamera}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <Camera className="w-4 h-4 text-teal-700" />
                <span>Use Camera</span>
              </button>

              <button
                type="button"
                onClick={handleStartManualEntry}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:underline whitespace-nowrap shrink-0"
              >
                <span>Or enter values manually</span>
              </button>
            </div>
          </div>

          {/* Live Camera Capture Preview */}
          {cameraActive && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-950 text-white space-y-3">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full max-h-80 object-contain rounded-lg"
              />
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={captureCameraFrame}
                  className="px-5 py-2 text-xs font-semibold bg-teal-600 hover:bg-teal-700 rounded-lg"
                >
                  Capture Photo
                </button>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="px-4 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-700 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Thumbnail Strip with Blur Warning, Reorder, and Remove */}
          {pages.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Prepared Pages ({pages.length} / {MAX_PAGES})
                </h3>
                <button
                  type="button"
                  disabled={extractingAi}
                  onClick={handleRunExtractionPipeline}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  {extractingAi ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Running Call A (Extract) & Call B (Verify)...</span>
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      <span>Read & Verify {pages.length} Page(s) with AI</span>
                    </>
                  )}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {pages.map((p, idx) => (
                  <div
                    key={p.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 bg-slate-50/60 dark:bg-slate-800/40 flex flex-col justify-between space-y-2.5"
                  >
                    <div className="relative">
                      <img
                        src={p.dataUrl}
                        alt={`Page ${p.pageNumber}: ${p.fileName}`}
                        referrerPolicy="no-referrer"
                        className="w-full h-36 object-cover rounded-lg border border-slate-200 dark:border-slate-700"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-200">
                        <span>Page {p.pageNumber}</span>
                        <span className="font-mono text-[11px] text-slate-500">
                          {p.width}×{p.height}px
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">{p.fileName}</p>

                      {p.isBlurry ? (
                        <div className="rounded bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 p-2 text-[11px] text-amber-900 dark:text-amber-200 flex items-center justify-between gap-2">
                          <span>Image looks slightly blurry (sharpness {p.blurScore}).</span>
                          <button
                            type="button"
                            onClick={() => {
                              handleRemovePage(p.id);
                              fileInputRef.current?.click();
                            }}
                            className="underline font-semibold shrink-0"
                          >
                            Retake
                          </button>
                        </div>
                      ) : (
                        <div className="text-[11px] text-emerald-700 dark:text-emerald-400">
                          Sharpness verified (score {p.blurScore})
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMovePage(idx, -1)}
                          aria-label="Move page left"
                          className="p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-30 rounded"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === pages.length - 1}
                          onClick={() => handleMovePage(idx, 1)}
                          aria-label="Move page right"
                          className="p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-30 rounded"
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemovePage(p.id)}
                        className="inline-flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: Mandatory Review & Confirmation Table */}
      {inReviewStep && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-6">
          {/* Metadata Header */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Report Date
              </label>
              <input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Laboratory / Source Name
              </label>
              <input
                type="text"
                value={labName}
                onChange={(e) => setLabName(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Document Category
              </label>
              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value as DocumentType)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
              >
                <option value="blood">Blood Sugar & Metabolic Panel</option>
                <option value="lipid">Lipid Profile</option>
                <option value="kidney">Kidney Function (KFT / ACR)</option>
                <option value="BP-reading">Blood Pressure / Monitor Reading</option>
                <option value="pathology/biopsy">Cancer Pathology / Biopsy Report</option>
                <option value="imaging">Imaging Summary</option>
                <option value="other">Other Clinical Report</option>
              </select>
            </div>
          </div>

          {/* Unconfirmed Banner */}
          {unconfirmedCount > 0 ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50/90 dark:bg-amber-950/40 dark:border-amber-800 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5 text-xs text-amber-950 dark:text-amber-100">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">
                    {unconfirmedCount} value(s) marked “{dict.common.needsYourCheck}”:
                  </span>{" "}
                  Please verify the highlighted row(s) against your report and click{" "}
                  <strong>Confirm value</strong> to unlock analysis.
                </div>
              </div>
              <button
                type="button"
                onClick={handleConfirmAllRows}
                className="px-3.5 py-1.5 text-xs font-semibold text-amber-950 bg-amber-200/80 hover:bg-amber-300 rounded-lg whitespace-nowrap shrink-0 self-start sm:self-center"
              >
                Confirm All {unconfirmedCount} Flagged Row(s)
              </button>
            </div>
          ) : (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 dark:bg-emerald-950/30 dark:border-emerald-800 p-3.5 flex items-center gap-2 text-xs text-emerald-900 dark:text-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>
                All {rows.length} test row(s) are confirmed. Click{" "}
                <strong>{dict.common.analyseButton}</strong> below to run the deterministic engine.
              </span>
            </div>
          )}

          {/* Editable Test Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500">
                  <th className="py-2.5 pr-3">Test Name (Printed / Canonical)</th>
                  <th className="py-2.5 px-3 w-28">Value</th>
                  <th className="py-2.5 px-3 w-28">Unit</th>
                  <th className="py-2.5 px-3 w-24">Ref Low</th>
                  <th className="py-2.5 px-3 w-24">Ref High</th>
                  <th className="py-2.5 px-3">Confidence & Verification</th>
                  <th className="py-2.5 pl-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800 text-xs">
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={
                      !row.confirmedByUser
                        ? "bg-amber-50/60 dark:bg-amber-950/20"
                        : "hover:bg-slate-50/60 dark:hover:bg-slate-800/30"
                    }
                  >
                    <td className="py-2.5 pr-3">
                      <input
                        type="text"
                        value={row.nameAsPrinted}
                        onChange={(e) =>
                          handleUpdateRow(row.id, "nameAsPrinted", e.target.value)
                        }
                        className="w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-medium"
                      />
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Mapped: {row.displayName}
                      </div>
                    </td>

                    <td className="py-2.5 px-3">
                      <input
                        type="number"
                        step="any"
                        value={row.value}
                        onChange={(e) => handleUpdateRow(row.id, "value", e.target.value)}
                        className="w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-mono tabular-nums text-right"
                      />
                    </td>

                    <td className="py-2.5 px-3">
                      <input
                        type="text"
                        value={row.unit}
                        onChange={(e) => handleUpdateRow(row.id, "unit", e.target.value)}
                        className="w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-mono"
                      />
                    </td>

                    <td className="py-2.5 px-3">
                      <input
                        type="number"
                        step="any"
                        value={row.refLow ?? ""}
                        onChange={(e) => handleUpdateRow(row.id, "refLow", e.target.value)}
                        placeholder="—"
                        className="w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs font-mono tabular-nums text-right"
                      />
                    </td>

                    <td className="py-2.5 px-3">
                      <input
                        type="number"
                        step="any"
                        value={row.refHigh ?? ""}
                        onChange={(e) => handleUpdateRow(row.id, "refHigh", e.target.value)}
                        placeholder="—"
                        className="w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1.5 text-xs font-mono tabular-nums text-right"
                      />
                    </td>

                    <td className="py-2.5 px-3">
                      <div className="flex flex-col gap-1">
                        <span className="font-mono tabular-nums text-[11px] text-slate-600 dark:text-slate-400">
                          Confidence {Math.round(row.confidence * 100)}% ·{" "}
                          {row.confirmedByUser ? (
                            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                              {dict.common.confirmed}
                            </span>
                          ) : (
                            <span className="text-amber-700 dark:text-amber-400 font-semibold">
                              {dict.common.needsYourCheck}
                            </span>
                          )}
                        </span>
                        {row.plausibilityWarning && (
                          <span className="text-[11px] text-rose-700 dark:text-rose-400">
                            {row.plausibilityWarning}
                          </span>
                        )}
                        {row.clinicalReviewNote && (
                          <span className="text-[11px] text-amber-800 dark:text-amber-300">
                            {row.clinicalReviewNote}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-2.5 pl-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        {!row.confirmedByUser && (
                          <button
                            type="button"
                            onClick={() => handleConfirmRow(row.id)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-amber-700 hover:bg-amber-800 rounded-md whitespace-nowrap shrink-0"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>{dict.common.confirmRow}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(row.id)}
                          aria-label={`Delete ${row.nameAsPrinted}`}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Add Row + Final Analyse Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={handleAddBlankRow}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors self-start"
            >
              <Plus className="w-4 h-4 text-teal-700" />
              <span>Add Another Test Row</span>
            </button>

            <div className="flex items-center gap-3 self-end sm:self-center">
              <button
                type="button"
                disabled={!canAnalyse}
                onClick={handleFinalAnalyse}
                className="inline-flex items-center gap-2 px-6 py-3 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-colors whitespace-nowrap shrink-0"
              >
                {analysingReport ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Running Engine & Plain-Language Explainer...</span>
                  </>
                ) : (
                  <>
                    <span>{dict.common.analyseButton}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
