import crypto from "node:crypto";
import { test, expect } from "@playwright/test";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const SESSION_SECRET = process.env.CI_AUTH_SESSION_SECRET ?? "";

function browseToken(secret) {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + 12 * 60 * 60 * 1000;
  const payload = `browse.${issuedAt}.${expiresAt}`;
  const signature = crypto
    .createHmac("sha256", `couponshare-auth-session-v1:${secret}`)
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

function collectDiagnostics(page) {
  const pageErrors = [];
  const failedAssets = [];
  const apiResponses = [];

  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    const url = response.url();
    if (url.includes("/api/dunnes-")) {
      apiResponses.push(`${response.status()} ${url}`);
    }
    if ((url.includes("/_next/") || url.includes("/_vinext/") || url.includes("/assets/")) && response.status() >= 400) {
      failedAssets.push(`${response.status()} ${url}`);
    }
  });
  page.on("requestfailed", (request) => {
    const url = request.url();
    if (url.includes("/_next/") || url.includes("/_vinext/") || url.includes("/assets/")) {
      failedAssets.push(`FAILED ${url}`);
    }
  });

  return { pageErrors, failedAssets, apiResponses };
}

test("login client hydrates and handles state changes", async ({ page }) => {
  const diagnostics = collectDiagnostics(page);
  await page.addInitScript(() => localStorage.setItem("couponshare-language-v1", "en"));

  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "Sign up", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await expect(page.getByText("Confirm password", { exact: true })).toBeVisible();

  expect(diagnostics.pageErrors).toEqual([]);
  expect(diagnostics.failedAssets).toEqual([]);
});

test("Dunnes client loads database state and handles controls", async ({ page, context }) => {
  expect(SESSION_SECRET.length).toBeGreaterThanOrEqual(32);
  const diagnostics = collectDiagnostics(page);

  await context.addCookies([{
    name: "couponshare_browse_v1",
    value: browseToken(SESSION_SECRET),
    url: BASE_URL,
    httpOnly: true,
    secure: false,
    sameSite: "Lax",
  }]);
  await page.addInitScript(() => localStorage.setItem("couponshare-language-v1", "en"));

  await page.goto(`${BASE_URL}/diagnostics/client`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("client-phase")).toHaveText("hydrated", { timeout: 10000 });
  await page.getByRole("button", { name: "Increment" }).click();
  await expect(page.getByTestId("click-count")).toHaveText("1");

  const directApi = await page.evaluate(async () => {
    const response = await fetch("/api/dunnes-vouchers?deviceKey=cccccccc-cccc-4ccc-8ccc-cccccccccccc", {
      cache: "no-store",
      credentials: "same-origin",
    });
    return { status: response.status, text: await response.text() };
  });
  console.log("DIRECT_DUNNES_API", JSON.stringify(directApi));
  expect(directApi.status).toBe(200);
  expect(directApi.text).toContain("2099-09-03");
  expect(directApi.text).toContain("1234");

  await page.goto(`${BASE_URL}/dunnes`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);

  const bodyText = await page.locator("body").innerText();
  console.log("DUNNES_PAGE_URL", page.url());
  console.log("DUNNES_API_RESPONSES", JSON.stringify(diagnostics.apiResponses));
  console.log("DUNNES_PAGE_ERRORS", JSON.stringify(diagnostics.pageErrors));
  console.log("DUNNES_FAILED_ASSETS", JSON.stringify(diagnostics.failedAssets));
  console.log("DUNNES_BODY", bodyText.slice(0, 4000));

  await expect(page.getByText(/2099-09-03.*1234/)).toBeVisible({ timeout: 10000 });
  expect(await page.getByText("Loading", { exact: true }).count()).toBe(0);

  const fifty = page.getByRole("tab", { name: "€50 or more" });
  await fifty.click();
  await expect(fifty).toHaveAttribute("aria-selected", "true");

  const menu = page.getByRole("button", { name: "Open menu" });
  await menu.click();
  await expect(page.locator("#couponshare-app-menu")).toHaveAttribute("aria-hidden", "false");

  expect(diagnostics.pageErrors).toEqual([]);
  expect(diagnostics.failedAssets).toEqual([]);
});
