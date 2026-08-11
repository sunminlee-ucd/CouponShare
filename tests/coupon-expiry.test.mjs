import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../app/coupon-expiry.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const expiry = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("parses Lidl coupon expiry date formats", () => {
  assert.equal(expiry.parseCouponExpiryDate("Valid until 13 Aug", "2026-08-09T12:00:00Z"), "2026-08-13");
  assert.equal(expiry.parseCouponExpiryDate("Expires 13/08/2026"), "2026-08-13");
  assert.equal(expiry.parseCouponExpiryDate("Valid to 2026-08-13"), "2026-08-13");
  assert.equal(expiry.parseCouponExpiryDate("31 Jan", "2026-12-20T12:00:00Z"), "2027-01-31");
});

test("keeps a coupon through its expiry day and expires it the next day", () => {
  assert.equal(expiry.isCouponExpired("13 Aug", "2026-08-09T12:00:00Z", "2026-08-13"), false);
  assert.equal(expiry.isCouponExpired("13 Aug", "2026-08-09T12:00:00Z", "2026-08-14"), true);
  assert.equal(expiry.isCouponExpired("기간 확인 필요", "2026-08-09T12:00:00Z", "2026-08-14"), false);
});
