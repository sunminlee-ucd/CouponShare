import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("opens the original Dunnes voucher enlarged without a second tap zoom", async () => {
  const [layout, enhancer, flow, enhancerStyles, display, displayStyles, barcodeRoute] = await Promise.all([
    readFile(new URL("../app/dunnes/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dunnes/DunnesBarcodeEnhancer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dunnes/VoucherScanFlow.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dunnes/DunnesBarcodeEnhancer.module.css", import.meta.url), "utf8"),
    readFile(new URL("../app/dunnes/VoucherBarcodeDisplay.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dunnes/VoucherBarcodeDisplay.module.css", import.meta.url), "utf8"),
    readFile(new URL("../app/api/dunnes-barcode/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /DunnesBarcodeEnhancer/);
  assert.match(enhancer, /VoucherScanFlow/);
  assert.match(flow, /VoucherBarcodeDisplay/);
  assert.match(enhancer, /showOriginalLightbox/);
  assert.match(enhancer, /fullImage\.src = image\.src/);
  assert.match(enhancer, /originalActions/);
  assert.match(enhancer, /originalComplete/);
  assert.match(enhancer, /✓ 사용완료/);
  assert.match(enhancer, /if \(action !== "complete"\) destroyOriginalLightbox\(\)/);
  assert.match(enhancer, /primaryButton\.disabled = true/);
  assert.match(enhancer, /couponshare:dunnes-scan-completion-error/);
  assert.match(enhancer, /event\.key === "Escape"/);
  assert.doesNotMatch(enhancer, /toggleZoom/);
  assert.doesNotMatch(enhancer, /targetWidth/);
  assert.doesNotMatch(enhancer, /originalImageZoomed/);
  assert.doesNotMatch(enhancer, /fullImage\.addEventListener\("click"/);
  assert.match(enhancerStyles, /@keyframes completionAttention/);
  assert.match(enhancerStyles, /animation: completionAttention 2s ease-out 3/);
  assert.match(enhancerStyles, /prefers-reduced-motion: reduce/);
  assert.match(enhancerStyles, /\.originalComplete/);
  assert.match(enhancerStyles, /min-width: 122px/);
  assert.match(enhancerStyles, /cursor: default/);
  assert.doesNotMatch(enhancerStyles, /\.originalImageZoomed/);

  assert.match(display, /autoOpen/);
  assert.match(display, /triggerRef\.current\.click\(\)/);
  assert.match(display, /data-dunnes-original-voucher-trigger="true"/);
  assert.match(display, /data-dunnes-scan-kind="voucher"/);
  assert.match(display, /dunnes-barcode/);
  assert.doesNotMatch(display, /tesseract\.js/);
  assert.match(displayStyles, /image-rendering: auto/);

  assert.match(barcodeRoute, /request\.json/);
  assert.match(barcodeRoute, /authenticatedRequestProfile\(request\)/);
  assert.match(barcodeRoute, /requestHasSameOrigin\(request\)/);
  assert.doesNotMatch(barcodeRoute, /deviceKey|device_key/);
});
