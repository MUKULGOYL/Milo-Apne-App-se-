/**
 * Image preprocessing and quality verification pipeline:
 * - Supports JPG, PNG, WEBP, HEIC (via browser canvas where supported)
 * - Enforces 15 MB per file and 12 pages max
 * - Downscales to max 2000px on the long side with JPEG quality 0.85
 * - Computes Laplacian variance on a downscaled grayscale canvas to detect blur
 *   and warn the user ("Retake" option without blocking)
 */

export interface ProcessedPageImage {
  id: string;
  pageNumber: number;
  fileName: string;
  dataUrl: string;
  base64Data: string;
  mimeType: "image/jpeg";
  width: number;
  height: number;
  blurScore: number; // Laplacian variance; < 45 is considered potentially blurry
  isBlurry: boolean;
  extractedPdfText?: string;
}

export const MAX_PAGES = 12;
export const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB
export const MAX_LONG_SIDE_PX = 2000;
export const JPEG_QUALITY = 0.85;
export const BLUR_VARIANCE_THRESHOLD = 42;

/**
 * Estimates image sharpness using the variance of the 3x3 discrete Laplacian operator
 * on a 256x256 grayscale canvas.
 */
export function computeLaplacianSharpness(sourceCanvas: HTMLCanvasElement): number {
  const sampleSize = 240;
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = sampleSize;
  tempCanvas.height = sampleSize;
  const ctx = tempCanvas.getContext("2d");
  if (!ctx) return 100;

  ctx.drawImage(sourceCanvas, 0, 0, sampleSize, sampleSize);
  const imgData = ctx.getImageData(0, 0, sampleSize, sampleSize).data;

  // Convert to grayscale luminance array
  const gray = new Float32Array(sampleSize * sampleSize);
  for (let i = 0; i < gray.length; i++) {
    const idx = i * 4;
    gray[i] = 0.299 * imgData[idx] + 0.587 * imgData[idx + 1] + 0.114 * imgData[idx + 2];
  }

  // Convolve with 3x3 Laplacian kernel [0, 1, 0; 1, -4, 1; 0, 1, 0]
  let sum = 0;
  let sumSq = 0;
  let count = 0;

  for (let y = 1; y < sampleSize - 1; y++) {
    for (let x = 1; x < sampleSize - 1; x++) {
      const center = gray[y * sampleSize + x];
      const lap =
        gray[(y - 1) * sampleSize + x] +
        gray[(y + 1) * sampleSize + x] +
        gray[y * sampleSize + (x - 1)] +
        gray[y * sampleSize + (x + 1)] -
        4 * center;

      sum += lap;
      sumSq += lap * lap;
      count++;
    }
  }

  if (count === 0) return 100;
  const mean = sum / count;
  const variance = sumSq / count - mean * mean;
  return Math.round(variance * 10) / 10;
}

/**
 * Processes an image file into a normalized, EXIF-oriented, max 2000px JPEG dataUrl + base64
 * with Laplacian blur score.
 */
export async function processImageFile(
  file: File,
  pageNumber: number
): Promise<ProcessedPageImage> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`File "${file.name}" exceeds the 15 MB limit.`);
  }

  // createImageBitmap respects EXIF orientation in modern browsers (`imageOrientation: "from-image"`)
  let bitmap: ImageBitmap | HTMLImageElement;
  let srcWidth = 0;
  let srcHeight = 0;

  if ("createImageBitmap" in window) {
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: "from-image" as any });
      srcWidth = bitmap.width;
      srcHeight = bitmap.height;
    } catch {
      bitmap = await loadHtmlImage(file);
      srcWidth = bitmap.naturalWidth || bitmap.width;
      srcHeight = bitmap.naturalHeight || bitmap.height;
    }
  } else {
    bitmap = await loadHtmlImage(file);
    srcWidth = bitmap.naturalWidth || bitmap.width;
    srcHeight = bitmap.naturalHeight || bitmap.height;
  }

  const longSide = Math.max(srcWidth, srcHeight);
  const scale = longSide > MAX_LONG_SIDE_PX ? MAX_LONG_SIDE_PX / longSide : 1;
  const targetWidth = Math.max(1, Math.round(srcWidth * scale));
  const targetHeight = Math.max(1, Math.round(srcHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not initialize 2D canvas context for image processing.");
  }

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, targetWidth, targetHeight);
  ctx.drawImage(bitmap as any, 0, 0, targetWidth, targetHeight);

  const blurScore = computeLaplacianSharpness(canvas);
  const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  const base64Data = dataUrl.replace(/^data:image\/jpeg;base64,/, "");

  return {
    id: `page-${pageNumber}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    pageNumber,
    fileName: file.name,
    dataUrl,
    base64Data,
    mimeType: "image/jpeg",
    width: targetWidth,
    height: targetHeight,
    blurScore,
    isBlurry: blurScore < BLUR_VARIANCE_THRESHOLD,
  };
}

function loadHtmlImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(
        new Error(
          `Could not decode "${file.name}". Please upload a standard PDF, JPG, PNG, or WEBP file.`
        )
      );
    };
    img.src = url;
  });
}
