import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("opens the original Dunnes voucher instantly for lossless zoom scanning", async () => {
  const [layout, enhancer, enhancerStyles, display, displayStyles, barcodeRoute] = await Promise.all([
    readFile(new URL("../app/dunnes/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dunnes/DunnesBarcodeEnhancer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dunnes/DunnesBarcodeEnhancer.module.css", import.meta.url), "utf8"),
    readFile(new URL("../app/dunnes/VoucherBarcodeDisplay.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dunnes/VoucherBarcodeDisplay.module.css", import.meta.url), "utf8"),
    readFile(new URL("../app/api/dunnes-barcode/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /DunnesBarcodeEnhancer/);
  assert.match(enhancer, /VoucherBarcodeDisplay/);
  assert.match(enhancer, /ORIGINAL_IMAGE_SELECTOR/);
  assert.match(enhancer, /ORIGINAL_IMAGE_TRIGGER_SELECTOR/);
  assert.match(enhancer, /showOriginalLightbox/);
  assert.match(enhancer, /fullImage\.src = image\.src/);
  assert.match(enhancer, /targetWidth = Math\.min\(fullImage\.naturalWidth/);
  assert.match(enhancer, /originalImageZoomed/);
  assert.match(enhancer, /event\.key === "Escape"/);
  assert.match(enhancerStyles, /cursor: zoom-in/);
  assert.match(enhancerStyles, /\.originalImageZoomed/);
  assert.match(enhancerStyles, /touch-action: pinch-zoom/);
  assert.match(enhancerStyles, /image-rendering: auto/);

  assert.match(display, /alt={`\$\{label\} full voucher`}/);
  assert.match(display, /쿠폰을 눌러 확대해서 스캔/);
  assert.match(display, /data-dunnes-original-voucher-trigger="true"/);
  assert.match(display, /type="button"/);
  assert.match(display, /dunnes-barcode/);
  assert.doesNotMatch(display, /tesseract\.js/);
  assert.doesNotMatch(display, /createElement\("canvas"\)/);
  assert.doesNotMatch(display, /ocrAnchoredBarcodeBox|heuristicBarcodeBox|enhanceBarcodeCrop/);
  assert.match(displayStyles, /cursor: zoom-in/);
  assert.match(displayStyles, /image-rendering: auto/);

  assert.match(barcodeRoute, /request\.json/);
  assert.match(barcodeRoute, /authenticatedRequestProfile\(request\)/);
  assert.match(barcodeRoute, /requestHasSameOrigin\(request\)/);
  assert.doesNotMatch(barcodeRoute, /deviceKey|device_key/);
  assert.match(barcodeRoute, /image_data = \$\{imageData\}/);
  assert.match(barcodeRoute, /owner_id = \$\{profile\.id\}::uuid/);
  assert.match(barcodeRoute, /reserved_by = \$\{profile\.id\}::uuid and status = 'reserved'/);
  assert.doesNotMatch(barcodeRoute, /alter table|create table/i);
});
