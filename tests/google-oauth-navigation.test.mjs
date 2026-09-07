import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const guard = fs.readFileSync(new URL("../app/GoogleOAuthNavigationGuard.tsx", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const publicRuntime = fs.readFileSync(new URL("../app/PublicRuntime.tsx", import.meta.url), "utf8");

test("Google OAuth guard navigates synchronously to the OAuth start route", () => {
  assert.match(guard, /const GOOGLE_OAUTH_PATH = "\/api\/auth\/oauth\?provider=google"/);
  assert.match(guard, /window\.location\.href = GOOGLE_OAUTH_PATH/);
  assert.doesNotMatch(guard, /setTimeout/);
});

test("Google OAuth guard preserves return target and auto-login preference", () => {
  assert.match(guard, /OAUTH_CONTEXT_STORAGE_KEY/);
  assert.match(guard, /returnTo/);
  assert.match(guard, /autoLogin/);
});

test("public runtime mounts the Google OAuth navigation guard outside admin", () => {
  assert.match(layout, /<PublicRuntime \/>/);
  assert.match(publicRuntime, /GoogleOAuthNavigationGuard/);
  assert.match(publicRuntime, /pathname\.startsWith\("\/admin"\)/);
});
