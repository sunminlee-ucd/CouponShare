import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const stateRoute = await readFile(new URL("../app/api/dunnes-state/route.ts", import.meta.url), "utf8");

test("keeps Dunnes list reads lightweight", () => {
  assert.doesNotMatch(stateRoute, /function tidyVouchers/);
  assert.doesNotMatch(stateRoute, /delete from dunnes_vouchers/i);
  assert.doesNotMatch(stateRoute, /update dunnes_vouchers/i);

  assert.match(stateRoute, /v\.reserved_by = \$\{profileId\}::uuid[\s\S]*?then v\.image_data/);
  assert.match(stateRoute, /v\.reserved_by = \$\{profileId\}::uuid[\s\S]*?then v\.membership_image_data/);
  assert.match(stateRoute, /v\.reserved_at < now\(\) - interval '30 minutes'[\s\S]*?then 'available'/);
  assert.match(stateRoute, /v\.expires_on >= \(now\(\) at time zone 'Europe\/Dublin'\)::date/);
});
