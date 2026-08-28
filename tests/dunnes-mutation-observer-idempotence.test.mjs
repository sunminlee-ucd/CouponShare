import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Dunnes DOM observers only rewrite text when values change", async () => {
  const [guide, reservationStatus] = await Promise.all([
    readFile(new URL("../app/dunnes/DunnesUsageGuide.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/PublicVoucherReservationStatus.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(guide, /label && label\.textContent !== copy\.button/);
  assert.match(guide, /button\.getAttribute\("aria-label"\) !== copy\.button/);
  assert.match(reservationStatus, /badge && badge\.textContent !== copy\.badge/);
  assert.match(reservationStatus, /button\.textContent !== copy\.button/);
});
