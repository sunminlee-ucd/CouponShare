import { test, expect } from "@playwright/test";

const BASE_URL = process.env.CI_BASE_URL ?? "http://127.0.0.1:3000";
const ADMIN_PASSWORD = process.env.CI_ADMIN_PASSWORD ?? "ci-admin-password-0000000000000000";

test("admin stays compact on mobile and separates dense sections into subtabs", async ({ page }) => {
  test.setTimeout(30000);
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto(`${BASE_URL}/admin/login`, { waitUntil: "domcontentloaded" });
  const login = await page.evaluate(async (password) => {
    const response = await fetch("/api/admin/login", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password }),
    });
    return { status: response.status, text: await response.text() };
  }, ADMIN_PASSWORD);
  expect(login.status, login.text).toBe(200);

  const navigation = await page.goto(`${BASE_URL}/admin`, { waitUntil: "domcontentloaded" });
  expect(navigation?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "관리자 대시보드" })).toBeVisible({ timeout: 10000 });

  const primaryTabs = page.getByRole("tablist", { name: "Admin sections" });
  await expect(primaryTabs).toBeVisible();
  const primaryMetrics = await primaryTabs.evaluate((element) => {
    const tabs = [...element.querySelectorAll("button")];
    const first = tabs[0]?.getBoundingClientRect();
    const firstSmall = tabs[0]?.querySelector("small");
    return {
      height: first?.height ?? 0,
      smallDisplay: firstSmall ? getComputedStyle(firstSmall).display : null,
    };
  });
  expect(primaryMetrics.height).toBeLessThanOrEqual(38);
  expect(primaryMetrics.smallDisplay).toBe("none");

  await page.getByRole("tab", { name: /Vouchers/ }).click();
  const voucherSubtabs = page.locator("#reviews .admin-secondary-tabs");
  await expect(voucherSubtabs).toBeVisible();
  await expect(voucherSubtabs.getByRole("tab", { name: "현황" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: "사용완료 현황" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "현재 예약 중인 Dunnes 바우처" })).toHaveCount(0);

  await voucherSubtabs.getByRole("tab", { name: "예약 중" }).click();
  await expect(voucherSubtabs.getByRole("tab", { name: "예약 중" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: "현재 예약 중인 Dunnes 바우처" })).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole("heading", { name: "사용완료 현황" })).toHaveCount(0);

  await voucherSubtabs.getByRole("tab", { name: "검수·신고" }).click();
  await expect(voucherSubtabs.getByRole("tab", { name: "검수·신고" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: "Dunnes 바우처 사후 검수" })).toBeVisible({ timeout: 10000 });

  await page.getByRole("tab", { name: /Users/ }).click();
  const usersSlot = page.locator(".admin-account-users-slot");
  await expect(usersSlot).toBeVisible();
  const userSubtabs = usersSlot.locator(".admin-secondary-tabs");
  await expect(userSubtabs.getByRole("tab", { name: "활동" })).toHaveAttribute("aria-selected", "true");

  await userSubtabs.getByRole("tab", { name: "계정" }).click();
  await expect(userSubtabs.getByRole("tab", { name: "계정" })).toHaveAttribute("aria-selected", "true");
  await expect(usersSlot.getByRole("heading", { name: "계정 사용자 관리" })).toBeVisible({ timeout: 10000 });

  const layoutMetrics = await page.evaluate(() => {
    const slot = document.querySelector(".admin-account-users-slot");
    const topbar = document.querySelector(".admin-topbar");
    const secondary = document.querySelector(".admin-account-users-slot .admin-secondary-tabs");
    return {
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      slotTop: slot ? slot.getBoundingClientRect().top : null,
      topbarHeight: topbar ? topbar.getBoundingClientRect().height : null,
      secondaryHeight: secondary ? secondary.getBoundingClientRect().height : null,
    };
  });

  expect(layoutMetrics.scrollWidth).toBeLessThanOrEqual(layoutMetrics.viewportWidth + 1);
  expect(layoutMetrics.slotTop).not.toBeNull();
  expect(layoutMetrics.slotTop).toBeLessThanOrEqual(100);
  expect(layoutMetrics.topbarHeight).toBeLessThanOrEqual(54);
  expect(layoutMetrics.secondaryHeight).toBeLessThanOrEqual(40);
});
