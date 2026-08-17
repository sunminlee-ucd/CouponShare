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

const DEVICE_KEY_STORAGE_KEY = "couponshare-device-key-v2";

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
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
  const sidePadding = 56;
  const topPadding = 32;
  const targetInnerWidth = 1280;
  const targetScale = targetInnerWidth / sourceWidth;
  const targetInnerHeight = Math.max(150, Math.round(sourceHeight * targetScale));
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
    const contrasted = clamp(Math.round((gray - 128) * 1.45 + 128), 0, 255);
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
  const [processing, setProcessing] = useState(true);
  const copy = language === "en" ? {
    hint: "Turn up your screen brightness and hold the barcode flat toward the checkout scanner.",
    processing: "Preparing a larger barcode…",
    fallback: "The barcode area could not be detected automatically. Use the full voucher below.",
    reference: "Full voucher reference",
  } : language === "fa" ? {
    hint: "روشنایی صفحه را زیاد کنید و بارکد را صاف روبه‌روی اسکنر صندوق نگه دارید.",
    processing: "در حال آماده‌سازی بارکد بزرگ‌تر…",
    fallback: "ناحیه بارکد به‌صورت خودکار پیدا نشد. از تصویر کامل ووچر در پایین استفاده کنید.",
    reference: "تصویر کامل ووچر",
  } : {
    hint: "계산대 스캐너가 읽기 쉽도록 화면 밝기를 높이고 바코드를 정면으로 보여주세요.",
    processing: "바코드를 크게 준비하고 있습니다…",
    fallback: "바코드 영역을 자동으로 찾지 못했습니다. 아래 전체 바우처를 사용해 주세요.",
    reference: "전체 바우처 참고",
  };

  useEffect(() => {
    let cancelled = false;
    setResolvedBarcode(barcode ?? null);
    if (barcode) return () => { cancelled = true; };
    const deviceKey = localStorage.getItem(DEVICE_KEY_STORAGE_KEY);
    if (!deviceKey) return () => { cancelled = true; };
    void fetch("/api/dunnes-barcode", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deviceKey, imageData }),
    }).then(async (response) => {
      if (!response.ok) return;
      const result = await response.json() as { barcode?: string };
      if (!cancelled && typeof result.barcode === "string") setResolvedBarcode(result.barcode);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [barcode, imageData]);

  useEffect(() => {
    let cancelled = false;
    const image = new Image();
    image.src = imageData;
    image.decode().then(async () => {
      if (cancelled) return;
      const scale = Math.min(1, 900 / image.naturalWidth);
      const analysis = document.createElement("canvas");
      analysis.width = Math.max(1, Math.round(image.naturalWidth * scale));
      analysis.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = analysis.getContext("2d");
      if (!context) throw new Error("canvas unavailable");
      context.fillStyle = "#fff";
      context.fillRect(0, 0, analysis.width, analysis.height);
      context.drawImage(image, 0, 0, analysis.width, analysis.height);

      const box = await detectorBarcodeBox(analysis) ?? heuristicBarcodeBox(analysis);
      if (cancelled) return;
      setBarcodeImage(box ? enhanceBarcodeCrop(image, analysis, box) : null);
    }).catch(() => {
      if (!cancelled) setBarcodeImage(null);
    }).finally(() => {
      if (!cancelled) setProcessing(false);
    });
    return () => { cancelled = true; };
  }, [imageData]);

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
