import { test, expect } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Authentication", () => {
  test("user can request a magic link", async ({ page }) => {
    // Mock the magic link API response
    await page.route("**/api/send-magic-link", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, message: "Magic link sent" }),
      });
    });

    await page.goto("/auth");
    
    // Switch to Magic Link tab
    await page.getByRole("button", { name: /magic link/i }).click();
    
    // Fill email and send
    await page.getByPlaceholder(/you@example.com/i).fill("test-user@example.com");
    await page.getByRole("button", { name: /send magic link/i }).click();

    // Verify confirmation message
    await expect(
      page.locator("text=Magic link sent")
    ).toBeVisible({ timeout: 10_000 });
  });

  test("unauthenticated user is redirected away from protected pages", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/auth/);
  });
});
