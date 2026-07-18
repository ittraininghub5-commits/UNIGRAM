import { test, expect } from "@playwright/test";

test.describe("Messaging workflow", () => {
  test("user can navigate to messages and verify list or send a message", async ({
    page,
  }) => {
    // Navigate to messages page
    await page.goto("/messages");

    // Verify main header
    await expect(page.locator("h2", { hasText: "Messages" })).toBeVisible();

    const emptyStateText = page.locator("text=No conversations found.");
    const conversationThread = page.locator("button:has-text('Messages') ~ div button"); // matches buttons in list

    // Wait for empty state or conversation list
    await expect(
      emptyStateText.or(page.locator("aside button")).first()
    ).toBeVisible({ timeout: 8000 });

    const firstThread = page.locator("aside .overflow-y-auto button").first();
    if (await firstThread.isVisible()) {
      // Select the first thread
      await firstThread.click();

      // Check if message input is enabled
      const input = page.locator("input[placeholder='Type a message...']");
      await expect(input).toBeVisible();
      
      if (await input.isEnabled()) {
        await input.fill("Hey there! Test E2E message.");
        
        // Submit message
        const sendBtn = page.locator("button[type='submit']");
        await expect(sendBtn).toBeEnabled();
        await sendBtn.click();

        // Verify it was rendered in the messages pane
        await expect(page.locator("text=Hey there! Test E2E message.")).toBeVisible();
      }
    }
  });
});
