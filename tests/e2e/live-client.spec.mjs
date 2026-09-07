import { test, expect } from "@playwright/test";

const LIVE_URL = process.env.LIVE_BASE_URL ?? "https://couponshare-ireland-493377120974.europe-west1.run.app";

function collectClientDiagnostics(page) {
  const pageErrors = [];
  const failedAssets = [];
  const failedResponses = [];
  const consoleMessages = [];

  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => consoleMessages.push(`${message.type()}: ${message.text()}`));
  page.on("response", (response) => {
    const url = response.url();
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.request().resourceType()} ${url}`);
    if ((url.includes("/_next/") || url.includes("/_vinext/") || url.includes("/assets/")) && response.status() >= 400) {
      failedAssets.push(`${response.status()} ${url}`);
    }
  });
  page.on("requestfailed", (request) => {
    const url = request.url();
    failedResponses.push(`FAILED ${request.resourceType()} ${url} ${request.failure()?.errorText ?? "unknown"}`);
    if (url.includes("/_next/") || url.includes("/_vinext/") || url.includes("/assets/")) {
      failedAssets.push(`FAILED ${url}`);
    }
  });

  return { pageErrors, failedAssets, failedResponses, consoleMessages };
}

test("deployed Cloud Run can reach the production database", async ({ page }) => {
  await page.goto(`${LIVE_URL}/diagnostics/client`, { waitUntil: "domcontentloaded", timeout: 20000 });

  const result = await page.evaluate(async () => {
    const entry = await fetch("/api/auth/browse", {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
    });
    const entryText = await entry.text();
    if (!entry.ok) {
      return { entryStatus: entry.status, entryText, healthStatus: null, healthText: null };
    }

    const health = await fetch("/api/database", {
      cache: "no-store",
      credentials: "same-origin",
    });
    return {
      entryStatus: entry.status,
      entryText,
      healthStatus: health.status,
      healthText: await health.text(),
    };
  });

  console.log("LIVE_DATABASE_ENTRY", JSON.stringify({ status: result.entryStatus, body: result.entryText }));
  console.log("LIVE_DATABASE_HEALTH", JSON.stringify({ status: result.healthStatus, body: result.healthText }));

  expect(result.entryStatus).toBe(200);
  expect(result.healthStatus).toBe(200);
  expect(JSON.parse(result.healthText)).toMatchObject({ connected: true, provider: "postgresql" });
});

test("deployed Cloud Run client hydrates and handles clicks", async ({ page, context }) => {
  const diagnostics = collectClientDiagnostics(page);

  const raw = await context.request.get(`${LIVE_URL}/diagnostics/client`, { timeout: 15000 });
  const rawText = await raw.text();
  console.log("LIVE_RAW_DOCUMENT", JSON.stringify({
    status: raw.status(),
    url: raw.url(),
    contentType: raw.headers()["content-type"] ?? null,
    location: raw.headers().location ?? null,
    length: rawText.length,
    prefix: rawText.slice(0, 2000),
  }));

  const navigation = await page.goto(`${LIVE_URL}/diagnostics/client`, { waitUntil: "domcontentloaded", timeout: 20000 });
  console.log("LIVE_NAVIGATION", JSON.stringify({
    status: navigation?.status() ?? null,
    responseUrl: navigation?.url() ?? null,
    pageUrl: page.url(),
  }));
  console.log("LIVE_BODY", JSON.stringify((await page.locator("body").innerText({ timeout: 5000 }).catch((error) => `BODY_ERROR ${String(error)}`)).slice(0, 4000)));
  console.log("LIVE_PAGE_ERRORS", JSON.stringify(diagnostics.pageErrors));
  console.log("LIVE_FAILED_RESPONSES", JSON.stringify(diagnostics.failedResponses));
  console.log("LIVE_FAILED_ASSETS", JSON.stringify(diagnostics.failedAssets));
  console.log("LIVE_CONSOLE", JSON.stringify(diagnostics.consoleMessages));

  expect(raw.status()).toBe(200);
  expect(rawText).toContain("client-phase");
  await expect(page.getByTestId("client-phase")).toHaveText("hydrated", { timeout: 15000 });
  await page.getByRole("button", { name: "Increment" }).click();
  await expect(page.getByTestId("click-count")).toHaveText("1");

  expect(diagnostics.pageErrors).toEqual([]);
  expect(diagnostics.failedAssets).toEqual([]);
});

test("deployed Dunnes page leaves loading state and remains interactive", async ({ page }) => {
  test.setTimeout(45000);

  await page.addInitScript(() => localStorage.setItem("couponshare-language-v1", "en"));
  await page.goto(`${LIVE_URL}/diagnostics/client`, { waitUntil: "domcontentloaded", timeout: 20000 });

  const browseEntry = await page.evaluate(async () => {
    const response = await fetch("/api/auth/browse", {
      method: "POST",
      cache: "no-store",
      credentials: "same-origin",
    });
    return { status: response.status, text: await response.text() };
  });
  console.log("LIVE_BROWSE_ENTRY", JSON.stringify(browseEntry));
  expect(browseEntry.status).toBe(200);

  // Let the bootstrap page finish all of its own requests before we start
  // collecting failures for the Dunnes navigation. Otherwise Playwright can
  // report requests cancelled by page.goto() as Dunnes asset failures even
  // though they belong to the page being replaced.
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});

  const diagnostics = collectClientDiagnostics(page);
  const dunnesResponses = [];
  page.on("response", (response) => {
    if (response.url().includes("/api/dunnes-")) {
      dunnesResponses.push(`${response.status()} ${response.url()}`);
    }
  });

  const stateResponsePromise = page.waitForResponse(
    (response) => response.url().includes("/api/dunnes-vouchers") && response.request().method() === "GET",
    { timeout: 20000 },
  );
  const navigation = await page.goto(`${LIVE_URL}/dunnes`, { waitUntil: "domcontentloaded", timeout: 20000 });
  const stateResponse = await stateResponsePromise;
  console.log("LIVE_DUNNES_NAVIGATION", JSON.stringify({
    status: navigation?.status() ?? null,
    responseUrl: navigation?.url() ?? null,
    pageUrl: page.url(),
  }));
  console.log("LIVE_DUNNES_STATE", JSON.stringify({
    status: stateResponse.status(),
    url: stateResponse.url(),
    body: (await stateResponse.text()).slice(0, 2000),
  }));

  await expect(page.getByRole("heading", { name: "Free Dunnes vouchers" })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("Loading", { exact: true })).toHaveCount(0, { timeout: 15000 });

  const fifty = page.getByRole("tab", { name: "€50 or more" });
  await fifty.click();
  await expect(fifty).toHaveAttribute("aria-selected", "true");

  const menu = page.getByRole("button", { name: "Open menu" });
  await menu.click();
  await expect(page.locator("#couponshare-app-menu")).toHaveAttribute("aria-hidden", "false");

  console.log("LIVE_DUNNES_API_RESPONSES", JSON.stringify(dunnesResponses));
  console.log("LIVE_DUNNES_BODY", JSON.stringify((await page.locator("body").innerText()).slice(0, 5000)));
  console.log("LIVE_DUNNES_PAGE_ERRORS", JSON.stringify(diagnostics.pageErrors));
  console.log("LIVE_DUNNES_FAILED_RESPONSES", JSON.stringify(diagnostics.failedResponses));
  console.log("LIVE_DUNNES_FAILED_ASSETS", JSON.stringify(diagnostics.failedAssets));

  expect(stateResponse.status()).toBe(200);
  expect(diagnostics.pageErrors).toEqual([]);
  expect(diagnostics.failedAssets).toEqual([]);
});
