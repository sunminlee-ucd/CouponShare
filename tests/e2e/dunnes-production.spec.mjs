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
  const navigations = [];
  const documentResponses = [];
  const consoleMessages = [];

  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => consoleMessages.push(`${message.type()}: ${message.text()}`));
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) navigations.push(frame.url());
  });
  page.on("response", (response) => {
    const url = response.url();
    if (response.request().resourceType() === "document") {
      documentResponses.push(`${response.status()} ${url}`);
    }
    if (url.includes("/api/dunnes-")) {
      apiResponses.push(`${response.status()} ${url}`);
    }
    if ((url.includes("/_next/") || url.includes("/_vinext/") || url.includes("/assets/")) && response.status() >= 400) {
      failedAssets.push(`${response.status()} ${url}`);
    }
  });
  page.on("requestfailed", (request) => {
    const url = request.url();
    if (request.resourceType() === "document") {
      documentResponses.push(`FAILED ${url} ${request.failure()?.errorText ?? "unknown"}`);
    }
    if (url.includes("/_next/") || url.includes("/_vinext/") || url.includes("/assets/")) {
      failedAssets.push(`FAILED ${url}`);
    }
  });

  return { pageErrors, failedAssets, apiResponses, navigations, documentResponses, consoleMessages };
}

async function boundedDocumentState(page) {
  return Promise.race([
    page.evaluate(() => ({
      readyState: document.readyState,
      hasHtml: Boolean(document.documentElement),
      hasBody: Boolean(document.body),
      title: document.title,
      bodyText: document.body?.innerText.slice(0, 4000) ?? "",
      htmlPrefix: document.documentElement?.outerHTML.slice(0, 2000) ?? "",
    })).catch((error) => ({ evaluateError: String(error) })),
    new Promise((resolve) => setTimeout(() => resolve({ evaluateTimeout: true }), 5000)),
  ]);
}

async function assertDomMutationResponsiveness(page) {
  const probe = page.evaluate(async () => {
    for (let index = 0; index < 250; index += 1) {
      const marker = document.createElement("i");
      marker.hidden = true;
      marker.dataset.dunnesMutationStress = "true";
      document.body.appendChild(marker);
      marker.remove();
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
    return "responsive";
  });

  const result = await Promise.race([
    probe,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Dunnes event loop stalled after DOM mutation stress")), 3000)),
  ]);
  expect(result).toBe("responsive");
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
  test.setTimeout(45000);
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

  const rawDocument = await context.request.get(`${BASE_URL}/dunnes`, { timeout: 10000 });
  const rawDocumentText = await rawDocument.text();
  console.log("RAW_DUNNES_DOCUMENT", JSON.stringify({
    status: rawDocument.status(),
    contentType: rawDocument.headers()["content-type"] ?? null,
    location: rawDocument.headers().location ?? null,
    length: rawDocumentText.length,
    prefix: rawDocumentText.slice(0, 1500),
  }));
  expect(rawDocument.status()).toBe(200);
  expect(rawDocumentText).toContain("<body");

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

  const navigationResponse = await page.goto(`${BASE_URL}/dunnes`, { waitUntil: "commit", timeout: 10000 });
  console.log("DUNNES_NAVIGATION_COMMIT", JSON.stringify({
    status: navigationResponse?.status() ?? null,
    url: navigationResponse?.url() ?? null,
    currentUrl: page.url(),
  }));

  await page.waitForLoadState("domcontentloaded", { timeout: 10000 }).catch((error) => {
    console.log("DUNNES_DOMCONTENTLOADED_ERROR", String(error));
  });
  await page.waitForTimeout(1500);

  const documentState = await boundedDocumentState(page);
  console.log("DUNNES_PAGE_URL", page.url());
  console.log("DUNNES_NAVIGATIONS", JSON.stringify(diagnostics.navigations));
  console.log("DUNNES_DOCUMENT_RESPONSES", JSON.stringify(diagnostics.documentResponses));
  console.log("DUNNES_API_RESPONSES", JSON.stringify(diagnostics.apiResponses));
  console.log("DUNNES_PAGE_ERRORS", JSON.stringify(diagnostics.pageErrors));
  console.log("DUNNES_FAILED_ASSETS", JSON.stringify(diagnostics.failedAssets));
  console.log("DUNNES_CONSOLE", JSON.stringify(diagnostics.consoleMessages));
  console.log("DUNNES_DOCUMENT_STATE", JSON.stringify(documentState));

  expect(documentState).toMatchObject({ hasBody: true });
  await expect(page.getByText(/2099-09-03.*1234/)).toBeVisible({ timeout: 10000 });
  expect(await page.getByText("Loading", { exact: true }).count()).toBe(0);

  await assertDomMutationResponsiveness(page);

  const guideButton = page.getByRole("button", { name: "How to use", exact: true });
  await guideButton.click();
  await expect(page.getByRole("dialog", { name: "How to use" })).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "How to use" })).toHaveCount(0);

  const fifty = page.getByRole("tab", { name: "€50 or more" });
  await fifty.click();
  await expect(fifty).toHaveAttribute("aria-selected", "true");

  const menu = page.getByRole("button", { name: "Open menu" });
  await menu.click();
  await expect(page.locator("#couponshare-app-menu")).toHaveAttribute("aria-hidden", "false");

  expect(diagnostics.pageErrors).toEqual([]);
  expect(diagnostics.failedAssets).toEqual([]);
});
