import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("moves account, language, reporting and logout controls into a responsive sidebar", async () => {
  const [sidebar, sidebarCss, layout, reportButton, reportCss] = await Promise.all([
    readFile(new URL("../app/AppSidebar.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/AppSidebar.module.css", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ErrorReportButton.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ErrorReportButton.module.css", import.meta.url), "utf8"),
  ]);

  assert.match(sidebar, /\/api\/auth\/status/);
  assert.match(sidebar, /\/profile/);
  assert.match(sidebar, /\/settings/);
  assert.match(sidebar, /\/api\/auth\/logout/);
  assert.match(sidebar, /ErrorReportButton/);
  assert.match(sidebar, /setLanguage/);
  assert.match(sidebar, /event\.key === "Escape"/);
  assert.match(sidebar, /document\.body\.style\.overflow = "hidden"/);
  assert.match(sidebar, /aria-modal="true"/);
  assert.match(sidebarCss, /transform: translateX\(-102%\)/);
  assert.match(sidebarCss, /topbar > \.topbar-error-button/);

  assert.match(layout, /<AppSidebar \/>/);
  assert.doesNotMatch(layout, /<LanguageSwitcher \/>|<AuthStatusControl \/>/);
  assert.match(reportButton, /embedded/);
  assert.match(reportButton, /createPortal/);
  assert.match(reportCss, /\.embedded/);
});
