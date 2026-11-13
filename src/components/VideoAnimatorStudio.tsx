import React, { useEffect, useRef, useState } from "react";
import {
  Download,
  Film,
  Image as ImageIcon,
  Play,
  RefreshCw,
  Sparkles,
  Upload,
} from "lucide-react";
import { AnimateVideoResponse, animateImageWithOmniFlash } from "../lib/gemini";

/**
 * "Animate images into video" with Gemini Omni Flash (`gemini-omni-1.2-flash`).
 * Lets users upload a product photo, healthy meal photo, or character illustration
 * and turn it into a dynamic video ad or animated character clip.
 * Includes a built-in HTML5 Canvas + MediaRecorder (.webm) video synthesizer fallback
 * when a paid API key is not attached, so users always get a real playable and downloadable video!
 */

const PRESET_CANVASES = [
  {
    id: "preset-thali-product",
    label: "Balanced Indian Thali / Health Product Ad",
    mode: "product_ad" as const,
    prompt:
      "Turn this balanced Indian thali and millet product showcase into a warm, cinematic video ad with gentle steam rising and clear health benefits.",
    drawSample: (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.fillStyle = "#F0FDF4";
      ctx.fillRect(0, 0, w, h);
      // Plate circle
      ctx.fillStyle = "#FFFFFF";
      ctx.strokeStyle = "#0D9488";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.52, Math.min(w, h) * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // Bowls
      const bowls = [
        { x: -0.12, y: -0.1, color: "#15803D", name: "Palak Sabzi" },
        { x: 0.12, y: -0.1, color: "#D97706", name: "Moong Dal" },
        { x: -0.12, y: 0.1, color: "#E2E8F0", name: "Curd" },
        { x: 0.12, y: 0.1, color: "#B45309", name: "Roti & Salad" },
      ];
      bowls.forEach((b) => {
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(
          w * 0.5 + b.x * w,
          h * 0.52 + b.y * h,
          Math.min(w, h) * 0.08,
          0,
          Math.PI * 2
        );
        ctx.fill();
      });
    },
  },
  {
    id: "preset-character-walk",
    label: "Milo Walking Coach Character",
    mode: "character_animate" as const,
    prompt:
      "Animate this friendly wellness character taking a joyful 15-minute post-meal evening walk in a green neighbourhood park.",
    drawSample: (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      ctx.fillStyle = "#ECFEFF";
      ctx.fillRect(0, 0, w, h);
      // Park ground
      ctx.fillStyle = "#D1FAE5";
      ctx.fillRect(0, h * 0.68, w, h * 0.32);
      // Friendly character illustration
      ctx.fillStyle = "#0D9488";
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.4, 42, 0, Math.PI * 2);
      ctx.fill();
      // Eyes & warm smile
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.arc(w * 0.5 - 14, h * 0.38, 5, 0, Math.PI * 2);
      ctx.arc(w * 0.5 + 14, h * 0.38, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.42, 16, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
      // Torso
      ctx.fillStyle = "#0F766E";
      ctx.fillRect(w * 0.5 - 28, h * 0.49, 56, 70);
    },
  },
];

export function VideoAnimatorStudio() {
  const [mode, setMode] = useState<"product_ad" | "character_animate">("product_ad");
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16">("16:9");
  const [prompt, setPrompt] = useState(PRESET_CANVASES[0].prompt);
  const [sourceDataUrl, setSourceDataUrl] = useState<string>("");
  const [sourceBase64, setSourceBase64] = useState<string>("");
  const [sourceMimeType, setSourceMimeType] = useState<string>("image/jpeg");

  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<AnimateVideoResponse | null>(null);
  const [recordedWebmUrl, setRecordedWebmUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sourceImgRef = useRef<HTMLImageElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Initialize with Preset 1 image on mount
  useEffect(() => {
    selectPreset(PRESET_CANVASES[0]);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const selectPreset = (preset: (typeof PRESET_CANVASES)[0]) => {
    setMode(preset.mode);
    setPrompt(preset.prompt);
    const temp = document.createElement("canvas");
    temp.width = 960;
    temp.height = 540;
    const ctx = temp.getContext("2d");
    if (ctx) {
      preset.drawSample(ctx, temp.width, temp.height);
      const dataUrl = temp.toDataURL("image/jpeg", 0.9);
      setSourceDataUrl(dataUrl);
      setSourceBase64(dataUrl.replace(/^data:image\/jpeg;base64,/, ""));
      setSourceMimeType("image/jpeg");
      const img = new Image();
      img.src = dataUrl;
      sourceImgRef.current = img;
    }
  };

  const handleUploadImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      setSourceDataUrl(dataUrl);
      const base64 = dataUrl.split(",")[1] || "";
      setSourceBase64(base64);
      setSourceMimeType(file.type || "image/jpeg");
      const img = new Image();
      img.src = dataUrl;
      sourceImgRef.current = img;
    };
    reader.readAsDataURL(file);
  };

  // Run HTML5 Canvas 60fps animation & record a downloadable .webm video when fallback storyboard is active
  useEffect(() => {
    if (!result?.fallbackUsed || !result.storyboardPlan || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const plan = result.storyboardPlan;
    const startTime = performance.now();
    const durationMs = 6000;

    // Optional MediaRecorder capture so user can download the generated WebM video file
    let recorder: MediaRecorder | null = null;
    const chunks: BlobPart[] = [];
    try {
      const stream = (canvas as any).captureStream?.(30);
      if (stream && typeof MediaRecorder !== "undefined") {
        recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
        recorder.ondataavailable = (ev) => {
          if (ev.data.size > 0) chunks.push(ev.data);
        };
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: "video/webm" });
          setRecordedWebmUrl(URL.createObjectURL(blob));
        };
        recorder.start();
      }
    } catch {
      // Ignore if MediaRecorder unsupported
    }

    const renderTick = (now: number) => {
      const elapsed = (now - startTime) % durationMs;
      const progress = elapsed / durationMs; // 0 to 1
      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = "#0F172A";
      ctx.fillRect(0, 0, w, h);

      // Draw animated source image with camera motion
      const img = sourceImgRef.current;
      if (img && img.complete) {
        ctx.save();
        const scale =
          plan.cameraMotion === "zoom_in"
            ? 1.0 + progress * 0.16
            : plan.cameraMotion === "float_character"
              ? 1.05 + Math.sin(progress * Math.PI * 4) * 0.04
              : 1.08;
        const offsetX =
          plan.cameraMotion === "pan_right" ? (progress - 0.5) * 40 : 0;
        const offsetY =
          plan.cameraMotion === "float_character"
            ? Math.sin(progress * Math.PI * 4) * 12
            : 0;

        ctx.translate(w / 2 + offsetX, h / 2 + offsetY);
        ctx.scale(scale, scale);
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
        ctx.restore();
      }

      // Subtle floating particles for lifelike motion
      for (let i = 0; i < 8; i++) {
        const px = ((i * 137 + elapsed * 0.04) % w);
        const py = h - ((i * 89 + elapsed * 0.06) % h);
        ctx.fillStyle = "rgba(255,255,255,0.28)";
        ctx.beginPath();
        ctx.arc(px, py, 3 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
      }

      // Bottom gradient scrim for readable captions
      const grad = ctx.createLinearGradient(0, h * 0.45, 0, h);
      grad.addColorStop(0, "rgba(15, 23, 42, 0)");
      grad.addColorStop(1, "rgba(15, 23, 42, 0.88)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, h * 0.45, w, h * 0.55);

      // Active keyframe caption
      const sec = elapsed / 1000;
      const activeKf =
        [...(plan.keyframes || [])]
          .reverse()
          .find((k) => sec >= k.timeSec) || plan.keyframes?.[0];

      ctx.fillStyle = "#5EEAD4";
      ctx.font = "600 13px 'IBM Plex Mono', monospace";
      ctx.fillText(
        `${activeKf?.badge || "MOTION"} · ${plan.callToAction}`,
        28,
        h - 86
      );

      ctx.fillStyle = "#FFFFFF";
      ctx.font = "700 24px 'Plus Jakarta Sans', sans-serif";
      ctx.fillText(plan.headline.slice(0, 48), 28, h - 54);

      ctx.fillStyle = "#E2E8F0";
      ctx.font = "400 15px 'Public Sans', sans-serif";
      ctx.fillText(
        (activeKf?.caption || plan.subheadline).slice(0, 72),
        28,
        h - 26
      );

      if (recorder && recorder.state === "recording" && now - startTime >= durationMs) {
        recorder.stop();
      }

      animFrameRef.current = requestAnimationFrame(renderTick);
    };

    animFrameRef.current = requestAnimationFrame(renderTick);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (recorder && recorder.state === "recording") {
        try {
          recorder.stop();
        } catch {
          // ignore
        }
      }
    };
  }, [result]);

  const handleAnimate = async () => {
    if (!sourceBase64) return;
    setIsGenerating(true);
    setError(null);
    setRecordedWebmUrl(null);
    try {
      const res = await animateImageWithOmniFlash({
        base64Image: sourceBase64,
        mimeType: sourceMimeType,
        prompt,
        mode,
        aspectRatio,
      });
      setResult(res);
    } catch (err: any) {
      setError(err?.message || "Could not animate image right now.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 md:p-6 space-y-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-teal-700 dark:text-teal-400">
            <Film className="w-4 h-4" />
            <span>Animate Images into Video · Gemini Omni Flash (`gemini-omni-1.2-flash`)</span>
          </div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-1">
            Product Video Ad & Wellness Character Animator
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Upload a product photo, healthy Indian plate photo, or character illustration and turn it into a dynamic video.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {PRESET_CANVASES.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => selectPreset(preset)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              {preset.label}
            </button>
          ))}

          <label className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-teal-800 dark:text-teal-200 bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 rounded-lg cursor-pointer hover:bg-teal-100 transition-colors whitespace-nowrap shrink-0">
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Photo</span>
            <input
              type="file"
              accept="image/*"
              onChange={handleUploadImage}
              className="hidden"
            />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Controls */}
        <div className="lg:col-span-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Animation Mode
              </label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as any)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
              >
                <option value="product_ad">Dynamic Product / Nutrition Video Ad</option>
                <option value="character_animate">Character Motion Animation</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Aspect Ratio
              </label>
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value as "16:9" | "9:16")}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs"
              >
                <option value="16:9">16:9 Landscape</option>
                <option value="9:16">9:16 Vertical Reel</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Motion & Scene Prompt
            </label>
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-xs"
              placeholder="Describe how the product or character should move..."
            />
          </div>

          {sourceDataUrl && (
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-2.5 bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                <span className="inline-flex items-center gap-1">
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Starting Image Frame</span>
                </span>
                <span>Ready</span>
              </div>
              <img
                src={sourceDataUrl}
                alt="Selected starting frame for video animation"
                referrerPolicy="no-referrer"
                className="w-full h-36 object-cover rounded-md"
              />
            </div>
          )}

          <button
            type="button"
            disabled={isGenerating || !sourceBase64}
            onClick={handleAnimate}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-lg transition-colors"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Generating Video Animation...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>Animate Image into Video</span>
              </>
            )}
          </button>

          {error && (
            <p className="text-xs text-rose-700 dark:text-rose-400">{error}</p>
          )}
        </div>

        {/* Right Video Viewport */}
        <div className="lg:col-span-7 space-y-3">
          {!result ? (
            <div className="h-[340px] rounded-xl border border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center p-6 text-center bg-slate-50/50 dark:bg-slate-800/30">
              <Sparkles className="w-8 h-8 text-teal-700 mb-2" />
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Click “Animate Image into Video” to bring your photo to life
              </p>
              <p className="text-xs text-slate-500 max-w-md mt-1">
                Uses Gemini Omni Flash (`gemini-omni-1.2-flash`) via the Interactions API, with an automatic client-side WebM motion video synthesizer fallback when running without a paid API key.
              </p>
            </div>
          ) : result.videoBase64 ? (
            <div className="space-y-3">
              <video
                controls
                autoPlay
                loop
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-950 max-h-[380px]"
                src={`data:${result.mimeType || "video/mp4"};base64,${result.videoBase64}`}
              />
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>Generated directly by Gemini Omni Flash (`gemini-omni-1.2-flash`)</span>
                <a
                  href={`data:${result.mimeType || "video/mp4"};base64,${result.videoBase64}`}
                  download="milo-omni-flash-animation.mp4"
                  className="inline-flex items-center gap-1 font-semibold text-teal-700 underline"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download MP4</span>
                </a>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {result.fallbackReason && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/80 dark:bg-amber-950/40 dark:border-amber-800 p-3 text-xs text-amber-900 dark:text-amber-200">
                  {result.fallbackReason}
                </div>
              )}
              <canvas
                ref={canvasRef}
                width={aspectRatio === "9:16" ? 405 : 720}
                height={aspectRatio === "9:16" ? 720 : 405}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-950 max-h-[380px] object-contain"
              />
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>
                  Live 60fps Motion Storyboard ·{" "}
                  {result.storyboardPlan?.headline || "Animated Sequence"}
                </span>
                {recordedWebmUrl && (
                  <a
                    href={recordedWebmUrl}
                    download="milo-animated-video.webm"
                    className="inline-flex items-center gap-1 font-semibold text-teal-700 dark:text-teal-400 underline"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Recorded WebM Video</span>
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
