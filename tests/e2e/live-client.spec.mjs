import { test, expect } from "@playwright/test";

const LIVE_URL = process.env.LIVE_BASE_URL ?? "https://couponshare-ireland-493377120974.europe-west1.run.app";

test("deployed Cloud Run client hydrates and handles clicks", async ({ page, context }) => {
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
  console.log("LIVE_PAGE_ERRORS", JSON.stringify(pageErrors));
  console.log("LIVE_FAILED_RESPONSES", JSON.stringify(failedResponses));
  console.log("LIVE_FAILED_ASSETS", JSON.stringify(failedAssets));
  console.log("LIVE_CONSOLE", JSON.stringify(consoleMessages));

  expect(raw.status()).toBe(200);
  expect(rawText).toContain("client-phase");
  await expect(page.getByTestId("client-phase")).toHaveText("hydrated", { timeout: 15000 });
  await page.getByRole("button", { name: "Increment" }).click();
  await expect(page.getByTestId("click-count")).toHaveText("1");

  expect(pageErrors).toEqual([]);
  expect(failedAssets).toEqual([]);
});
