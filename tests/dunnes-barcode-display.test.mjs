import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("enhances Dunnes voucher barcodes without changing the database schema", async () => {
  const [layout, enhancer, display, barcodeRoute] = await Promise.all([
    readFile(new URL("../app/dunnes/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dunnes/DunnesBarcodeEnhancer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dunnes/VoucherBarcodeDisplay.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/dunnes-barcode/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(layout, /DunnesBarcodeEnhancer/);
  assert.match(enhancer, /\.dunnes-reveal img\[alt\$=/);
  assert.match(enhancer, /VoucherBarcodeDisplay/);
  assert.match(enhancer, /couponshare-language-v1/);

  assert.match(display, /BarcodeDetector/);
  assert.match(display, /heuristicBarcodeBox/);
  assert.match(display, /targetInnerWidth = 1280/);
  assert.match(display, /sidePadding = 56/);
  assert.match(display, /1\.45/);
  assert.match(display, /fallbackImage/);
  assert.match(display, /dunnes-barcode/);

  assert.match(barcodeRoute, /request\.json/);
  assert.match(barcodeRoute, /device_key/);
  assert.match(barcodeRoute, /image_data = \$\{imageData\}/);
  assert.match(barcodeRoute, /owner_id = \$\{profile\.id\}::uuid/);
  assert.match(barcodeRoute, /reserved_by = \$\{profile\.id\}::uuid and status = 'reserved'/);
  assert.doesNotMatch(barcodeRoute, /alter table|create table/i);
});
