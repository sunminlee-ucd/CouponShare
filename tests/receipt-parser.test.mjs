import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../app/receipt-parser.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const parser = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("parses standard Lidl receipt items and ignores payment details", () => {
  const items = parser.parseLidlReceipt(`
    Thomas Street - IE9513674T
    EUR
    Avocado                         1.09 A
    Granulated Sugar                1.69 A
    -----------
    TOTAL                            2.78
    Credit Card                     2.78
    A 0.0% VAT             2.78     0.00
  `);
  assert.deepEqual(items.map(({ name, price }) => ({ name, price })), [
    { name: "Avocado", price: 1.09 },
    { name: "Granulated Sugar", price: 1.69 },
  ]);
});

test("attaches quantities, weights and Lidl discounts to the preceding product", () => {
  const items = parser.parseLidlReceipt(`
    Cat Litter                       4.98 C
      2 x 2.49
      Lidl Plus Coupon              -1.94
    Vine Tomatoes                    1.52 A
      0.448 kg x 3.39 EUR
      Lidl Plus Coupon              -0.59
    Lactose Free Milk                2.98 A
      2 x 1.49
    TOTAL                            9.48
  `);
  assert.equal(items.length, 3);
  assert.deepEqual(items[0], {
    id: "receipt-cat-litter-1",
    name: "Cat Litter",
    price: 4.98,
    priceDetected: true,
    quantity: 2,
    unitPrice: 2.49,
    discounts: [1.94],
  });
  assert.equal(items[1].weightKg, 0.448);
  assert.deepEqual(items[1].discounts, [0.59]);
  assert.equal(items[2].quantity, 2);
});

test("does not count deposits or discount rows as products", () => {
  const items = parser.parseLidlReceipt(`
    Coca Cola Zero                   1.99 C
    0.15 Deposit                     0.15 A
    HP Cajun Chicken Wrap            2.89 A
    Queen Green Olives w Cheddar     1.99 A
       Savings                      -0.30
    Organic Natural Yoghurt          0.69 A
    TOTAL                            7.41
  `);
  assert.deepEqual(items.map((item) => item.name), [
    "Coca Cola Zero",
    "HP Cajun Chicken Wrap",
    "Queen Green Olives w Cheddar",
    "Organic Natural Yoghurt",
  ]);
  assert.deepEqual(items[2].discounts, [0.3]);
});

test("parses a cropped long receipt even when TOTAL is outside the screenshot", () => {
  const items = parser.parseLidlReceipt(`
    Raspberries 250g                 3.49 A
      Lidl Plus Offers              -0.99
    Strawberries 250g                2.99 A
      Lidl Plus Offers              -0.49
    Cat Food Mousse Turkey           2.36 C
      4 x 0.59
    Mid & Prime Chicken Wings        2.79 A
    Extra Virgin Olive Oil 750ml     4.09 A
       Savings                      -0.34
    High Protein Yogurt Strawberry   1.29 A
  `);
  assert.equal(items.length, 6, JSON.stringify(items));
  assert.equal(items[2].quantity, 4);
  assert.deepEqual(items[4].discounts, [0.34]);
});

test("matches receipt names to imported coupon titles without a paid AI service", () => {
  const item = {
    id: "receipt-high-protein-yogurt-strawberry-1",
    name: "High Protein Yogurt Strawberry",
  };
  assert.equal(parser.receiptItemMatchesCoupon(item, {
    productId: "coupon-1",
    productName: "High Protein Strawberry Yoghurt",
    keywords: [],
  }), true);
  assert.equal(parser.receiptItemMatchesCoupon({ id: "receipt-chicken-thigh-fillet-1", name: "Chicken Thigh Fillet" }, {
    productId: "coupon-2",
    productName: "Chicken Fillets",
    keywords: [],
  }), true);
  assert.equal(parser.receiptItemMatchesCoupon(item, {
    productId: "coupon-3",
    productName: "Cat Litter",
    keywords: [],
  }), false);
});
