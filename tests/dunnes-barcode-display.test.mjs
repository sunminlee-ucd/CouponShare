import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("enhances Dunnes voucher barcodes without changing the database schema", async () => {
  const [layout, enhancer, enhancerStyles, display, barcodeRoute] = await Promise.all([
    readFile(new URL("../app/dunnes/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dunnes/DunnesBarcodeEnhancer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dunnes/DunnesBarcodeEnhancer.module.css", import.meta.url), "utf8"),
    readFile(new URL("../app/dunnes/VoucherBarcodeDisplay.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/dunnes-barcode/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /DunnesBarcodeEnhancer/);
  assert.match(enhancer, /\.dunnes-reveal img\[alt\$=/);
  assert.match(enhancer, /VoucherBarcodeDisplay/);
  assert.match(enhancer, /couponshare-language-v1/);
  assert.match(enhancer, /ORIGINAL_IMAGE_SELECTOR/);
  assert.match(enhancer, /showOriginalLightbox/);
  assert.match(enhancer, /dunnesOriginalVoucher/);
  assert.match(enhancer, /Close original voucher/);
  assert.match(enhancer, /event\.key === "Escape"/);
  assert.match(enhancerStyles, /cursor: zoom-in/);
  assert.match(enhancerStyles, /\.originalBackdrop/);
  assert.match(enhancerStyles, /\.originalImage/);
  assert.match(enhancerStyles, /touch-action: pinch-zoom/);

  assert.match(display, /ocrAnchoredBarcodeBox/);
  assert.match(display, /findBarcodeNumberLine/);
  assert.match(display, /barcodeLineScore/);
  assert.match(display, /refineBarcodeAboveNumber/);
  assert.match(display, /generousBarcodeBoxAboveNumber/);
  assert.match(display, /blocks: true/);
  assert.match(display, /tessedit_char_whitelist/);
  assert.match(display, /PSM\.SPARSE_TEXT/);
  assert.match(display, /if \(resolvedBarcode\) box = await ocrAnchoredBarcodeBox/);
  assert.match(display, /if \(!box\) box = await detectorBarcodeBox/);
  assert.match(display, /if \(!box\) box = heuristicBarcodeBox/);
  assert.match(display, /targetInnerWidth = 1280/);
  assert.match(display, /sidePadding = 64/);
  assert.match(display, /fallbackImage/);
  assert.match(display, /dunnes-barcode/);

  assert.match(barcodeRoute, /request\.json/);
  assert.match(barcodeRoute, /authenticatedRequestProfile\(request\)/);
  assert.match(barcodeRoute, /requestHasSameOrigin\(request\)/);
  assert.doesNotMatch(barcodeRoute, /deviceKey|device_key/);
  assert.match(barcodeRoute, /image_data = \$\{imageData\}/);
  assert.match(barcodeRoute, /owner_id = \$\{profile\.id\}::uuid/);
  assert.match(barcodeRoute, /reserved_by = \$\{profile\.id\}::uuid and status = 'reserved'/);
  assert.doesNotMatch(barcodeRoute, /alter table|create table/i);
});
