import { test, expect } from "@playwright/test";

const LIVE_URL = process.env.LIVE_BASE_URL ?? "https://couponshare-ireland-493377120974.europe-west1.run.app";

test("deployed Cloud Run client hydrates and handles clicks", async ({ page }) => {
  const pageErrors = [];
  const failedAssets = [];

  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    const url = response.url();
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

  await page.goto(`${LIVE_URL}/diagnostics/client`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("client-phase")).toHaveText("hydrated", { timeout: 15000 });
  await page.getByRole("button", { name: "Increment" }).click();
  await expect(page.getByTestId("click-count")).toHaveText("1");

  expect(pageErrors).toEqual([]);
  expect(failedAssets).toEqual([]);
});
