import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const guard = fs.readFileSync(new URL("../app/GoogleOAuthNavigationGuard.tsx", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");

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

test("root layout mounts the Google OAuth navigation guard", () => {
  assert.match(layout, /<GoogleOAuthNavigationGuard \/>/);
});
