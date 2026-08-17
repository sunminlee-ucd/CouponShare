"use client";
/* eslint-disable @next/next/no-img-element -- voucher images are private data URLs */

import { useEffect, useState } from "react";
import styles from "./VoucherBarcodeDisplay.module.css";

type AppLanguage = "ko" | "en" | "fa";
type Props = {
  imageData: string;
  barcode?: string | null;
  label: string;
  language?: AppLanguage;
};

type BarcodeBox = { x: number; y: number; width: number; height: number };
type DetectorResult = { boundingBox: BarcodeBox };
type BarcodeDetectorInstance = { detect: (source: HTMLCanvasElement) => Promise<DetectorResult[]> };
type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorInstance;
type OcrBbox = { x0: number; y0: number; x1: number; y1: number };
type OcrLine = { text?: string; bbox?: OcrBbox };
type OcrBlock = { paragraphs?: Array<{ lines?: OcrLine[] }> };

const DEVICE_KEY_STORAGE_KEY = "couponshare-device-key-v2";

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function normalizeDigits(value: string) {
  return value.replace(/\D/g, "");
}

function barcodeLineScore(lineText: string, barcode: string) {
  const lineDigits = normalizeDigits(lineText);
  const target = normalizeDigits(barcode);
  if (lineDigits.length < 8 || target.length < 8) return 0;
  if (lineDigits.includes(target)) return 1000 + target.length;
  if (target.includes(lineDigits) && lineDigits.length >= target.length - 2) return 900 + lineDigits.length;

  const suffixLength = Math.min(10, target.length, lineDigits.length);
  if (suffixLength >= 8 && lineDigits.endsWith(target.slice(-suffixLength))) return 700 + suffixLength;
  if (suffixLength >= 8 && target.endsWith(lineDigits.slice(-suffixLength))) return 650 + suffixLength;

  let matching = 0;
  const comparable = Math.min(target.length, lineDigits.length);
  for (let index = 1; index <= comparable; index += 1) {
    if (target[target.length - index] !== lineDigits[lineDigits.length - index]) break;
    matching += 1;
  }
  return matching >= 8 ? 500 + matching : 0;
}

function findBarcodeNumberLine(blocks: OcrBlock[] | null | undefined, barcode: string) {
  let best: { bbox: OcrBbox; score: number } | null = null;
  for (const block of blocks ?? []) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) {
        if (!line.bbox) continue;
        const score = barcodeLineScore(line.text ?? "", barcode);
        if (score > (best?.score ?? 0)) best = { bbox: line.bbox, score };
      }
    }
  }
  return best?.bbox ?? null;
}

function refineBarcodeAboveNumber(canvas: HTMLCanvasElement, numberBox: OcrBbox): BarcodeBox | null {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  const { width, height } = canvas;
  const lineHeight = Math.max(8, numberBox.y1 - numberBox.y0);
  const numberWidth = Math.max(40, numberBox.x1 - numberBox.x0);

  const searchLeft = Math.floor(clamp(numberBox.x0 - Math.max(numberWidth * 0.28, width * 0.07), 0, width - 2));
  const searchRight = Math.ceil(clamp(numberBox.x1 + Math.max(numberWidth * 0.28, width * 0.07), searchLeft + 2, width));
  const searchTop = Math.floor(clamp(numberBox.y0 - Math.max(lineHeight * 9, height * 0.16), 0, height - 2));
  const searchBottom = Math.ceil(clamp(numberBox.y0 + lineHeight * 0.15, searchTop + 2, height));
  const pixels = context.getImageData(0, 0, width, height).data;

  const dark = (x: number, y: number) => {
    const offset = (y * width + x) * 4;
    return pixels[offset] * 0.299 + pixels[offset + 1] * 0.587 + pixels[offset + 2] * 0.114 < 155;
  };

  const rowScores: Array<{ y: number; score: number }> = [];
  let maxScore = 0;
  for (let y = searchTop; y < searchBottom; y += 2) {
    let transitions = 0;
    let darkCount = 0;
    let previous = dark(searchLeft, y);
    for (let x = searchLeft + 2; x < searchRight; x += 2) {
      const current = dark(x, y);
      if (current) darkCount += 1;
      if (current !== previous) transitions += 1;
      previous = current;
    }
    const samples = Math.max(1, (searchRight - searchLeft) / 2);
    const darkRatio = darkCount / samples;
    const score = darkRatio >= 0.04 && darkRatio <= 0.72 ? transitions : 0;
    rowScores.push({ y, score });
    maxScore = Math.max(maxScore, score);
  }

  if (maxScore < Math.max(14, (searchRight - searchLeft) / 38)) return null;
  const threshold = maxScore * 0.48;
  let bestBand: { top: number; bottom: number; strength: number } | null = null;
  let start = -1;
  let strength = 0;
  for (let index = 0; index <= rowScores.length; index += 1) {
    const row = rowScores[index];
    const active = Boolean(row && row.score >= threshold);
    if (active && start < 0) {
      start = row.y;
      strength = 0;
    }
    if (active) strength += row.score;
    if ((!active || index === rowScores.length) && start >= 0) {
      const previousY = rowScores[Math.max(0, index - 1)]?.y ?? start;
      const bandHeight = previousY - start;
      if (bandHeight >= Math.max(10, lineHeight * 0.7) && strength > (bestBand?.strength ?? 0)) {
        bestBand = { top: start, bottom: previousY + 2, strength };
      }
      start = -1;
      strength = 0;
    }
  }

  if (!bestBand) return null;
  const bandHeight = bestBand.bottom - bestBand.top;
  const columnHits: number[] = [];
  for (let x = searchLeft; x < searchRight; x += 2) {
    let darkRows = 0;
    let samples = 0;
    for (let y = bestBand.top; y < bestBand.bottom; y += 2) {
      samples += 1;
      if (dark(x, y)) darkRows += 1;
    }
    if (darkRows / Math.max(1, samples) >= 0.32) columnHits.push(x);
  }

  let left = searchLeft;
  let right = searchRight;
  if (columnHits.length >= 12) {
    left = columnHits[0];
    right = columnHits[columnHits.length - 1] + 2;
  }

  const horizontalPadding = Math.max(18, (right - left) * 0.12);
  const topPadding = Math.max(12, bandHeight * 0.38);
  const bottomPadding = Math.max(lineHeight * 1.8, bandHeight * 0.38);
  const x = clamp(left - horizontalPadding, 0, width - 1);
  const y = clamp(bestBand.top - topPadding, 0, height - 1);
  const boxRight = clamp(right + horizontalPadding, x + 1, width);
  const boxBottom = clamp(numberBox.y1 + bottomPadding, y + 1, height);
  return { x, y, width: boxRight - x, height: boxBottom - y };
}

function generousBarcodeBoxAboveNumber(canvas: HTMLCanvasElement, numberBox: OcrBbox): BarcodeBox {
  const lineHeight = Math.max(8, numberBox.y1 - numberBox.y0);
  const numberWidth = Math.max(40, numberBox.x1 - numberBox.x0);
  const horizontalPadding = Math.max(numberWidth * 0.3, canvas.width * 0.08);
  const x = clamp(numberBox.x0 - horizontalPadding, 0, canvas.width - 1);
  const right = clamp(numberBox.x1 + horizontalPadding, x + 1, canvas.width);
  const y = clamp(numberBox.y0 - Math.max(lineHeight * 7.5, canvas.height * 0.13), 0, canvas.height - 1);
  const bottom = clamp(numberBox.y1 + lineHeight * 0.65, y + 1, canvas.height);
  return { x, y, width: right - x, height: bottom - y };
}

async function ocrAnchoredBarcodeBox(canvas: HTMLCanvasElement, barcode: string): Promise<BarcodeBox | null> {
  if (!normalizeDigits(barcode)) return null;
  let worker: { recognize: (...args: unknown[]) => Promise<{ data: { blocks?: OcrBlock[] | null } }>; setParameters: (params: Record<string, string>) => Promise<unknown>; terminate: () => Promise<unknown> } | null = null;
  try {
    const tesseract = await import("tesseract.js");
    worker = await tesseract.createWorker("eng") as unknown as typeof worker;
    if (!worker) return null;
    await worker.setParameters({
      tessedit_char_whitelist: "0123456789 -",
      tessedit_pageseg_mode: String(tesseract.PSM.SPARSE_TEXT),
    });
    const result = await worker.recognize(canvas, {}, { blocks: true });
    const numberBox = findBarcodeNumberLine(result.data.blocks, barcode);
    if (!numberBox) return null;
    return refineBarcodeAboveNumber(canvas, numberBox) ?? generousBarcodeBoxAboveNumber(canvas, numberBox);
  } catch {
    return null;
  } finally {
    if (worker) void worker.terminate().catch(() => undefined);
  }
}

function heuristicBarcodeBox(canvas: HTMLCanvasElement): BarcodeBox | null {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  const { width, height } = canvas;
  if (width < 120 || height < 120) return null;

  const pixels = context.getImageData(0, 0, width, height).data;
  const dark = (x: number, y: number) => {
    const offset = (y * width + x) * 4;
    const luminance = pixels[offset] * 0.299 + pixels[offset + 1] * 0.587 + pixels[offset + 2] * 0.114;
    return luminance < 150;
  };

  const firstRow = Math.floor(height * 0.18);
  const rowScores = new Array<number>(height).fill(0);
  let maximumScore = 0;
  for (let y = firstRow; y < height - 1; y += 2) {
    let transitions = 0;
    let darkCount = 0;
    let previous = dark(0, y);
    for (let x = 2; x < width; x += 2) {
      const current = dark(x, y);
      if (current) darkCount += 1;
      if (current !== previous) transitions += 1;
      previous = current;
    }
    const darkRatio = darkCount / Math.max(1, width / 2);
    if (darkRatio >= 0.035 && darkRatio <= 0.72) {
      const lowerPageBonus = 1 + (y / height) * 0.22;
      rowScores[y] = transitions * lowerPageBonus;
      maximumScore = Math.max(maximumScore, rowScores[y]);
    }
  }
  if (maximumScore < Math.max(18, width / 32)) return null;

  const threshold = maximumScore * 0.58;
  let bestStart = -1;
  let bestEnd = -1;
  let bestValue = 0;
  let start = -1;
  let value = 0;
  for (let y = firstRow; y <= height; y += 2) {
    const active = y < height && rowScores[y] >= threshold;
    if (active && start < 0) {
      start = y;
      value = 0;
    }
    if (active) value += rowScores[y];
    if ((!active || y >= height) && start >= 0) {
      const end = Math.min(height - 1, y - 2);
      if (end - start >= 10 && value > bestValue) {
        bestStart = start;
        bestEnd = end;
        bestValue = value;
      }
      start = -1;
      value = 0;
    }
  }
  if (bestStart < 0 || bestEnd <= bestStart) return null;

  const sampleTop = clamp(bestStart - 4, 0, height - 1);
  const sampleBottom = clamp(bestEnd + 4, sampleTop + 1, height);
  const activeColumns: number[] = [];
  for (let x = 0; x < width; x += 2) {
    let count = 0;
    let samples = 0;
    for (let y = sampleTop; y < sampleBottom; y += 2) {
      samples += 1;
      if (dark(x, y)) count += 1;
    }
    if (count / Math.max(1, samples) >= 0.28) activeColumns.push(x);
  }
  if (activeColumns.length < 20) return null;

  const left = activeColumns[0];
  const right = activeColumns[activeColumns.length - 1];
  const detectedWidth = right - left;
  if (detectedWidth < width * 0.28) return null;

  const rowHeight = bestEnd - bestStart;
  const horizontalPadding = Math.max(16, detectedWidth * 0.08);
  const verticalPadding = Math.max(12, rowHeight * 0.75);
  const x = clamp(left - horizontalPadding, 0, width - 1);
  const y = clamp(bestStart - verticalPadding, 0, height - 1);
  const boxRight = clamp(right + horizontalPadding, x + 1, width);
  const boxBottom = clamp(bestEnd + verticalPadding, y + 1, height);
  return { x, y, width: boxRight - x, height: boxBottom - y };
}

async function detectorBarcodeBox(canvas: HTMLCanvasElement): Promise<BarcodeBox | null> {
  const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
  if (!Detector) return null;
  try {
    const detector = new Detector({ formats: ["code_128", "ean_13", "ean_8", "upc_a", "upc_e"] });
    const results = await detector.detect(canvas);
    const candidate = results
      .map((result) => result.boundingBox)
      .filter((box) => box.width > canvas.width * 0.2 && box.height > 8)
      .sort((a, b) => b.width * b.height - a.width * a.height)[0];
    return candidate ?? null;
  } catch {
    return null;
  }
}

function enhanceBarcodeCrop(image: HTMLImageElement, analysisCanvas: HTMLCanvasElement, analysisBox: BarcodeBox) {
  const scaleX = image.naturalWidth / analysisCanvas.width;
  const scaleY = image.naturalHeight / analysisCanvas.height;
  const sourceX = clamp(Math.floor(analysisBox.x * scaleX), 0, image.naturalWidth - 1);
  const sourceY = clamp(Math.floor(analysisBox.y * scaleY), 0, image.naturalHeight - 1);
  const sourceWidth = clamp(Math.ceil(analysisBox.width * scaleX), 1, image.naturalWidth - sourceX);
  const sourceHeight = clamp(Math.ceil(analysisBox.height * scaleY), 1, image.naturalHeight - sourceY);

  const output = document.createElement("canvas");
  const sidePadding = 64;
  const topPadding = 38;
  const targetInnerWidth = 1280;
  const targetScale = targetInnerWidth / sourceWidth;
  const targetInnerHeight = Math.max(180, Math.round(sourceHeight * targetScale));
  output.width = targetInnerWidth + sidePadding * 2;
  output.height = targetInnerHeight + topPadding * 2;

  const context = output.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.fillStyle = "#fff";
  context.fillRect(0, 0, output.width, output.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, sidePadding, topPadding, targetInnerWidth, targetInnerHeight);

  const pixels = context.getImageData(sidePadding, topPadding, targetInnerWidth, targetInnerHeight);
  for (let index = 0; index < pixels.data.length; index += 4) {
    const red = pixels.data[index];
    const green = pixels.data[index + 1];
    const blue = pixels.data[index + 2];
    const gray = red * 0.299 + green * 0.587 + blue * 0.114;
    const contrasted = clamp(Math.round((gray - 128) * 1.32 + 128), 0, 255);
    pixels.data[index] = contrasted;
    pixels.data[index + 1] = contrasted;
    pixels.data[index + 2] = contrasted;
  }
  context.putImageData(pixels, sidePadding, topPadding);
  return output.toDataURL("image/png");
}

export default function VoucherBarcodeDisplay({ imageData, barcode, label, language = "ko" }: Props) {
  const [barcodeImage, setBarcodeImage] = useState<string | null>(null);
  const [resolvedBarcode, setResolvedBarcode] = useState<string | null>(barcode ?? null);
  const [barcodeReady, setBarcodeReady] = useState(Boolean(barcode));
  const [processing, setProcessing] = useState(true);
  const copy = language === "en" ? {
    hint: "Turn up your screen brightness and hold the barcode flat toward the checkout scanner.",
    processing: "Finding the barcode number and preparing a larger barcode…",
    fallback: "The barcode area could not be detected automatically. Use the full voucher below.",
    reference: "Full voucher reference",
  } : language === "fa" ? {
    hint: "روشنایی صفحه را زیاد کنید و بارکد را صاف روبه‌روی اسکنر صندوق نگه دارید.",
    processing: "در حال پیدا کردن شماره بارکد و آماده‌سازی بارکد بزرگ‌تر…",
    fallback: "ناحیه بارکد به‌صورت خودکار پیدا نشد. از تصویر کامل ووچر در پایین استفاده کنید.",
    reference: "تصویر کامل ووچر",
  } : {
    hint: "계산대 스캐너가 읽기 쉽도록 화면 밝기를 높이고 바코드를 정면으로 보여주세요.",
    processing: "바코드 번호 위치를 확인하고 크게 준비하고 있습니다…",
    fallback: "바코드 영역을 자동으로 찾지 못했습니다. 아래 전체 바우처를 사용해 주세요.",
    reference: "전체 바우처 참고",
  };

  useEffect(() => {
    let cancelled = false;
    setResolvedBarcode(barcode ?? null);
    setBarcodeReady(Boolean(barcode));
    if (barcode) return () => { cancelled = true; };
    const deviceKey = localStorage.getItem(DEVICE_KEY_STORAGE_KEY);
    if (!deviceKey) {
      setBarcodeReady(true);
      return () => { cancelled = true; };
    }
    void fetch("/api/dunnes-barcode", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deviceKey, imageData }),
    }).then(async (response) => {
      if (!response.ok) return;
      const result = await response.json() as { barcode?: string };
      if (!cancelled && typeof result.barcode === "string") setResolvedBarcode(result.barcode);
    }).catch(() => undefined).finally(() => {
      if (!cancelled) setBarcodeReady(true);
    });
    return () => { cancelled = true; };
  }, [barcode, imageData]);

  useEffect(() => {
    if (!barcodeReady) return;
    let cancelled = false;
    setProcessing(true);
    setBarcodeImage(null);
    const image = new Image();
    image.src = imageData;
    image.decode().then(async () => {
      if (cancelled) return;
      const scale = Math.min(1, 1100 / image.naturalWidth);
      const analysis = document.createElement("canvas");
      analysis.width = Math.max(1, Math.round(image.naturalWidth * scale));
      analysis.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = analysis.getContext("2d");
      if (!context) throw new Error("canvas unavailable");
      context.fillStyle = "#fff";
      context.fillRect(0, 0, analysis.width, analysis.height);
      context.drawImage(image, 0, 0, analysis.width, analysis.height);

      let box: BarcodeBox | null = null;
      if (resolvedBarcode) box = await ocrAnchoredBarcodeBox(analysis, resolvedBarcode);
      if (!box) box = await detectorBarcodeBox(analysis);
      if (!box) box = heuristicBarcodeBox(analysis);
      if (cancelled) return;
      setBarcodeImage(box ? enhanceBarcodeCrop(image, analysis, box) : null);
    }).catch(() => {
      if (!cancelled) setBarcodeImage(null);
    }).finally(() => {
      if (!cancelled) setProcessing(false);
    });
    return () => { cancelled = true; };
  }, [barcodeReady, imageData, resolvedBarcode]);

  return (
    <div className={styles.shell} dir={language === "fa" ? "rtl" : undefined}>
      <div className={styles.scanPanel}>
        <strong>{label}</strong>
        <span className={styles.scanHint}>{copy.hint}</span>
        {processing ? <div className={styles.processing}>{copy.processing}</div> : barcodeImage ? (
          <img className={styles.barcodeImage} src={barcodeImage} alt={`${label} enlarged barcode`} draggable={false} />
        ) : (
          <>
            <div className={styles.fallback}>{copy.fallback}</div>
            <img className={styles.fallbackImage} src={imageData} alt={`${label} voucher fallback`} draggable={false} />
          </>
        )}
        {resolvedBarcode && <code className={styles.barcodeNumber} dir="ltr">{resolvedBarcode}</code>}
      </div>
      <div className={styles.reference}>
        <span>{copy.reference}</span>
        <img src={imageData} alt={`${label} full voucher`} draggable={false} />
      </div>
    </div>
  );
}
