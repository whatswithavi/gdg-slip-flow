import { test, expect } from "@playwright/test";

/**
 * Flutter Web renders to a canvas via CanvasKit — its accessibility/semantics
 * DOM overlay isn't reliably scriptable to activate in this environment (a
 * bounded attempt was made and documented in DECISIONS.md), so this suite
 * doesn't drive the UI with click/fill locators the way a typical Playwright
 * test would. Instead: this test verifies the actual deployed app loads and
 * boots without error (exactly what would catch a regression like the
 * dart2js release-build crash found during development — see DECISIONS.md),
 * and api-flow.spec.ts drives the real backend end-to-end through the same
 * REST API the UI itself calls.
 */
test("Flutter Web app loads and Firebase initializes without a crash", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  await page.goto("/");

  await expect(page).toHaveTitle("Slip Flow", { timeout: 30000 });
  await expect(page.locator("flutter-view")).toBeAttached();

  expect(errors, `Console/page errors during load: ${errors.join("\n")}`).toEqual([]);
});
