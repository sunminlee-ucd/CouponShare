import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const login = fs.readFileSync(new URL("../app/login/page.tsx", import.meta.url), "utf8");

test("Google OAuth uses a native navigation target instead of delayed window.location", () => {
  assert.match(login, /href="\/api\/auth\/oauth\?provider=google"/);
  assert.doesNotMatch(login, /setTimeout\(\(\) => \{\s*window\.location\.assign\("\/api\/auth\/oauth\?provider=google"\)/);
});

test("Google OAuth click only stores context and lets the browser follow the link", () => {
  assert.match(login, /function prepareGoogleOAuth\(\)/);
  assert.match(login, /OAUTH_CONTEXT_STORAGE_KEY/);
});
