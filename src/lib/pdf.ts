import * as pdfjsLib from "pdfjs-dist";
import {
  BLUR_VARIANCE_THRESHOLD,
  computeLaplacianSharpness,
  JPEG_QUALITY,
  MAX_FILE_BYTES,
  MAX_LONG_SIDE_PX,
  MAX_PAGES,
  ProcessedPageImage,
} from "./ocr";

// Configure PDF.js worker using CDN matching installed version with graceful fallback
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
} catch {
  // Fallback handled during getDocument
}

/**
 * Renders each page of a PDF file to canvas at ~200 DPI (capped at 2000px on the long side)
 * and extracts the embedded PDF text layer to send alongside the page image.
 */
export async function processPdfFile(
  file: File,
  startPageNumber = 1
): Promise<ProcessedPageImage[]> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`PDF "${file.name}" exceeds the 15 MB limit.`);
  }

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: arrayBuffer,
  });

  const pdfDoc = await loadingTask.promise;
  const totalPages = Math.min(pdfDoc.numPages, MAX_PAGES - startPageNumber + 1);
  const results: ProcessedPageImage[] = [];

  for (let i = 1; i <= totalPages; i++) {
    const page = await pdfDoc.getPage(i);
    // 72 DPI is scale 1.0; ~200 DPI is scale 2.77
    const baseViewport = page.getViewport({ scale: 1.0 });
    const desiredScale = 200 / 72;
    const maxLongSideAtDesired = Math.max(
      baseViewport.width * desiredScale,
      baseViewport.height * desiredScale
    );
    const finalScale =
      maxLongSideAtDesired > MAX_LONG_SIDE_PX
        ? (MAX_LONG_SIDE_PX / maxLongSideAtDesired) * desiredScale
        : desiredScale;

    const viewport = page.getViewport({ scale: finalScale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Could not create canvas context for PDF rendering.");
    }

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: ctx,
      viewport,
      canvas,
    } as any).promise;

    // Extract PDF text layer if present
    let extractedPdfText = "";
    try {
      const textContent = await page.getTextContent();
      extractedPdfText = textContent.items
        .map((item: any) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
    } catch {
      extractedPdfText = "";
    }

    const blurScore = computeLaplacianSharpness(canvas);
    const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    const base64Data = dataUrl.replace(/^data:image\/jpeg;base64,/, "");

    results.push({
      id: `pdf-page-${startPageNumber + i - 1}-${Date.now()}`,
      pageNumber: startPageNumber + i - 1,
      fileName: `${file.name} (Page ${i})`,
      dataUrl,
      base64Data,
      mimeType: "image/jpeg",
      width: canvas.width,
      height: canvas.height,
      blurScore,
      isBlurry: blurScore < BLUR_VARIANCE_THRESHOLD,
      extractedPdfText,
    });
  }

  return results;
}
