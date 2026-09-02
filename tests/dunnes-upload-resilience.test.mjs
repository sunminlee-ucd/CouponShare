import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageSource = await readFile(new URL("../app/dunnes/page.tsx", import.meta.url), "utf8");

test("keeps a valid compressed voucher available when client OCR fails", () => {
  const handler = pageSource.match(/async function handleUpload[\s\S]*?\n {2}async function submitDraft/)?.[0] ?? "";
  assert.match(handler, /imageData = await compressVoucherImage\(file\);[\s\S]*?setDraftImage\(imageData\);/);
  assert.match(handler, /worker\.recognize\(imageData\)/);
  assert.match(handler, /catch \{\s*setNotice\("종류, 바코드 번호, 만료일을 모두 확인해 주세요\."\);\s*\}/);
  assert.doesNotMatch(handler, /Promise\.all\(\[import\("tesseract\.js"\), compressVoucherImage\(file\)\]\)/);
});

test("lets the member correct OCR output manually before sharing", () => {
  assert.match(pageSource, /<select value=\{draftType\}[\s\S]*?<option value="5off25">€5 OFF €25<\/option>[\s\S]*?<option value="10off40">€10 OFF €40<\/option>[\s\S]*?<option value="10off50">€10 OFF €50<\/option>/);
  assert.match(pageSource, /value=\{draftBarcode\}[\s\S]*?setDraftBarcode/);
  assert.match(pageSource, /type="date" value=\{draftExpiry\}/);
});

test("uses browser-compatible image loading and bounded OCR work", () => {
  assert.match(pageSource, /image\.onload = \(\) =>/);
  assert.match(pageSource, /image\.onerror = \(\) => reject/);
  assert.doesNotMatch(pageSource, /await image\.decode\(\)/);
  assert.match(pageSource, /const OCR_TIMEOUT_MS = 8_000;/);
  assert.match(pageSource, /withTimeout\(import\("tesseract\.js"\), OCR_TIMEOUT_MS\)/);
  assert.match(pageSource, /withTimeout\(worker\.recognize\(imageData\), OCR_TIMEOUT_MS\)/);
});

test("allows slower server-side review without aborting an upload prematurely", () => {
  assert.match(pageSource, /const UPLOAD_REQUEST_TIMEOUT_MS = 45_000;/);
  assert.match(pageSource, /action === "upload" \? UPLOAD_REQUEST_TIMEOUT_MS : REQUEST_TIMEOUT_MS/);
});

test("limits the file picker to formats that the upload pipeline stores", () => {
  const accepted = pageSource.match(/accept="image\/png,image\/jpeg,image\/webp"/g) ?? [];
  assert.ok(accepted.length >= 2);
});
