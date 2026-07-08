import { test, expect } from "@playwright/test";

/**
 * End-to-end test for the full user query flow.
 * Spec: user types a question, sees SQL, and results table.
 * Matches spec §7 of 04-testing-integration.md.
 */
test.describe("Query Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    // Wait for the query input to be visible
    await expect(page.locator("#query-input")).toBeVisible({ timeout: 10_000 });
  });

  test("user can ask a question and see results table", async ({ page }) => {
    // Type a business question
    await page.fill("#query-input", "Top 5 products last quarter");

    // Submit
    await page.click("#query-submit-btn");

    // Wait for AI processing (up to 30s for free-tier Groq)
    await expect(page.locator("table")).toBeVisible({ timeout: 30_000 });

    // SQL preview should exist (even if collapsed)
    await expect(page.locator("#sql-preview-toggle")).toBeVisible();
  });

  test("SQL preview expands when clicked and shows SELECT", async ({ page }) => {
    await page.fill("#query-input", "How many orders were placed yesterday?");
    await page.click("#query-submit-btn");

    // Wait for results
    await expect(page.locator("#sql-preview-toggle")).toBeVisible({ timeout: 30_000 });

    // Click to expand
    await page.click("#sql-preview-toggle");

    // SQL block should now contain SELECT
    await expect(page.locator("#sql-preview-code")).toContainText("SELECT", { timeout: 5_000 });
  });

  test("intent badge appears with classification label", async ({ page }) => {
    await page.fill("#query-input", "Show me customer churn rate");
    await page.click("#query-submit-btn");

    // StatusBadge should show some intent label
    await expect(page.locator('[role="status"]')).toBeVisible({ timeout: 30_000 });
  });

  test("example question dropdown appears on focus", async ({ page }) => {
    await page.click("#query-input");
    // Wait for the dropdown (rendered when input is focused and empty)
    await expect(page.locator("text=Example questions")).toBeVisible({ timeout: 3_000 });
  });

  test("empty input cannot be submitted", async ({ page }) => {
    const btn = page.locator("#query-submit-btn");
    await expect(btn).toBeDisabled();
  });
});
