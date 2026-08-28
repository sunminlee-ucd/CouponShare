import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("maintenance tester flow is documented", async () => {
  const doc = await readFile(new URL("../docs/maintenance-test-access.md", import.meta.url), "utf8");
  assert.match(doc, /signed pre-auth maintenance-test cookie/);
  assert.match(doc, /authenticated email exactly matches/);
  assert.match(doc, /Logging out clears/);
});
