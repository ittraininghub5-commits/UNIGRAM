import { test, expect } from "@playwright/test";

test.describe("Certificate page layout and features", () => {
  test("student can navigate to certificates page and verify structure", async ({
    page,
  }) => {
    // Navigate to certificates page
    await page.goto("/certificates");

    // Verify main header
    await expect(
      page.locator("h1", { hasText: "Certificates & Badges" })
    ).toBeVisible();

    // Verify presence of certificates list or empty state placeholder
    const emptyStateHeader = page.locator("h3:has-text('No Certificates Yet')");
    const certificateCard = page.locator(".group.relative.border.rounded-2xl");
    
    await expect(
      emptyStateHeader.or(certificateCard).first()
    ).toBeVisible({ timeout: 8000 });
    
    // If empty state is shown, verify browse courses button navigates to search
    if (await emptyStateHeader.isVisible()) {
      const browseBtn = page.getByRole("button", { name: /browse courses/i });
      await expect(browseBtn).toBeVisible();
      await browseBtn.click();
      await expect(page).toHaveURL(/\/search/);
    }
  });
});
