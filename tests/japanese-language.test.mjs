import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("supports Japanese across language controls and active Dunnes flows", async () => {
  const [i18n, japanese, loginSwitcher, login, sidebar, installGuide, enhancer, scanFlow] = await Promise.all([
    readFile(new URL("../app/i18n.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/i18n-ja.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/LoginLanguageSwitcher.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/login/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/AppSidebar.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/HomeInstallGuide.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dunnes/DunnesBarcodeEnhancer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/dunnes/VoucherScanFlow.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(i18n, /"ja"/);
  assert.match(i18n, /日本語/);
  assert.match(japanese, /"Dunnes 바우처 무료 나눔": "Dunnesバウチャー無料共有"/);
  assert.match(loginSwitcher, /id: "ja", label: "日本語"/);
  assert.match(login, /language === "ja"/);
  assert.match(login, /Googleで続ける/);
  assert.match(sidebar, /Dunnesバウチャー/);
  assert.match(installGuide, /ホーム画面にアプリのように追加/);
  assert.match(enhancer, /saved === "ja"/);
  assert.match(scanFlow, /使用済みにする/);
});
