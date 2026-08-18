import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("browse mode remains read-only and never creates Dunnes guest profiles", async () => {
  const [proxy, stateRoute, legacyDunnes] = await Promise.all([
    readFile(new URL("../proxy.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/dunnes-state/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/dunnes-vouchers/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(proxy, /pathname === "\/api\/dunnes-vouchers"/);
  assert.match(proxy, /target\.pathname = "\/api\/dunnes-state"/);
  assert.match(proxy, /pathname === "\/api\/error-reports"/);
  assert.match(proxy, /pathname === "\/api\/account"/);
  assert.match(proxy, /pathname === "\/settings"/);
  assert.match(stateRoute, /authenticatedRequestContext/);
  assert.match(stateRoute, /browseState/);
  assert.match(stateRoute, /reservationsRemaining: 0/);
  assert.doesNotMatch(stateRoute, /insert into profiles|device_key/);
  assert.match(legacyDunnes, /authenticatedProfile\(request\)/);
});

test("production closes Lidl wallet APIs while keeping feature-flagged code", async () => {
  const [proxy, features, wallet, qr] = await Promise.all([
    readFile(new URL("../proxy.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/features.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/coupon-wallet/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/coupon-wallet/qr/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(features, /NEXT_PUBLIC_LIDL_ENABLED === "true"/);
  assert.match(proxy, /!LIDL_ENABLED && pathname\.startsWith\("\/api\/coupon-wallet"\)/);
  assert.match(proxy, /feature_disabled/);
  assert.match(wallet, /findOrCreateProfile/);
  assert.match(qr, /ALPHA_GROUP_CODE/);
});

test("reports, barcode reveal and account APIs bind to the signed-in profile", async () => {
  const [helper, reports, barcode, account, settings, reportButton] = await Promise.all([
    readFile(new URL("../app/auth/request-profile.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/error-reports/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/dunnes-barcode/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/account/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/settings/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/ErrorReportButton.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(helper, /verifyUserAuthToken/);
  assert.match(helper, /auth_user_id = \$\{session\.authUserId\}::uuid/);
  assert.match(reports, /authenticatedRequestProfile\(request\)/);
  assert.doesNotMatch(reports, /insert into profiles|deviceKey/);
  assert.match(barcode, /authenticatedRequestProfile\(request\)/);
  assert.doesNotMatch(barcode, /deviceKey|device_key/);
  assert.match(account, /authenticatedRequestProfile\(request\)/);
  assert.doesNotMatch(account, /deviceKey|device_key/);
  assert.match(account, /delete from auth\.users/);
  assert.match(account, /clearUserAuthCookie/);
  assert.match(settings, /fetch\("\/api\/account"/);
  assert.doesNotMatch(settings, /recoveryCode|\/api\/access|\/access|deviceKey/);
  assert.doesNotMatch(reportButton, /JSON\.stringify\(\{ deviceKey/);
});

test("live policy pages no longer reference the retired invite access flow", async () => {
  const [privacy, terms] = await Promise.all([
    readFile(new URL("../app/privacy/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/terms/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(privacy, /href="\/access"|초대코드/);
  assert.doesNotMatch(terms, /href="\/access"|초대코드/);
  assert.match(privacy, /이메일 주소와 로그인 제공 방식/);
  assert.match(terms, /로그인 없이 둘러보기 모드/);
});
