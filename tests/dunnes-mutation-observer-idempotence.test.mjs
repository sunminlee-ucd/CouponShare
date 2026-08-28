import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";

const APP_DIR = fileURLToPath(new URL("../app/", import.meta.url));
const OBSERVER_CONSTRUCTION = /new\s+MutationObserver\s*\(/;

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(fullPath);
    return /\.(?:ts|tsx)$/.test(entry.name) ? [fullPath] : [];
  }));
  return nested.flat();
}

function relativeAppPath(filePath) {
  return `app/${path.relative(APP_DIR, filePath).replaceAll(path.sep, "/")}`;
}

test("Dunnes DOM observers are explicitly allowlisted and re-entry safe", async () => {
  const files = await sourceFiles(APP_DIR);
  const observerFiles = [];

  for (const filePath of files) {
    const source = await readFile(filePath, "utf8");
    if (OBSERVER_CONSTRUCTION.test(source)) observerFiles.push(relativeAppPath(filePath));
  }

  assert.deepEqual(observerFiles.sort(), [
    "app/DunnesMembershipGuard.tsx",
    "app/PublicVoucherReservationStatus.tsx",
    "app/ViewedVoucherUsageConfirmation.tsx",
    "app/dunnes/DunnesBarcodeEnhancer.tsx",
  ]);

  const [guide, reservationStatus, membershipGuard, viewedConfirmation, barcodeEnhancer] = await Promise.all([
    readFile(new URL("../app/dunnes/DunnesUsageGuide.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/PublicVoucherReservationStatus.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/DunnesMembershipGuard.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ViewedVoucherUsageConfirmation.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dunnes/DunnesBarcodeEnhancer.tsx", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(guide, OBSERVER_CONSTRUCTION);
  assert.doesNotMatch(guide, /\.textContent\s*=/);

  assert.match(reservationStatus, /badge && badge\.textContent !== copy\.badge/);
  assert.match(reservationStatus, /button\.textContent !== copy\.button/);

  assert.match(membershipGuard, /current\?\.element === host && current\.requiredTotal === selectedRequiredTotal/);
  assert.match(membershipGuard, /current\?\.element === host && current\.requiredTotal === requiredTotal/);

  assert.match(viewedConfirmation, /lockedImages\.current\.has\(imageData\)/);
  assert.match(barcodeEnhancer, /if \(mounted\?\.imageData === imageData\) return;/);
});
