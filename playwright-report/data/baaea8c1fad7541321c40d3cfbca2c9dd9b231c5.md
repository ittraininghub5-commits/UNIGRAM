# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: messaging.spec.ts >> Messaging workflow >> user can navigate to messages and verify list or send a message
- Location: tests\e2e\messaging.spec.ts:4:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: expect(locator).toBeVisible() failed

Locator: locator('input[placeholder=\'Type a message...\']')
Expected: visible
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('input[placeholder=\'Type a message...\']')

```

```yaml
- navigation:
  - link "U Unigram Social Learning":
    - /url: /feed
  - link "Feed":
    - /url: /feed
  - link "Search":
    - /url: /search
  - link "Messages":
    - /url: /messages
  - link "Courses":
    - /url: /courses
  - link "Collab":
    - /url: /collab
  - link "Certificates":
    - /url: /certificates
  - link "Games":
    - /url: /games
  - link "Notifications":
    - /url: /notifications
  - link "Settings":
    - /url: /settings
  - link "Profile":
    - /url: /profile/9385c255-5e7f-4106-9947-44464207d45c
  - button "Open appearance settings"
  - link "UT":
    - /url: /profile/9385c255-5e7f-4106-9947-44464207d45c
  - button "Sign Out"
- main:
  - button "Back"
  - heading "Search Unigram" [level=1]
  - textbox "Search mentors, courses, topics..."
  - button "All"
  - button "Mentors"
  - button "Students"
  - button "Courses"
  - heading "Popular Mentors & Courses" [level=3]
  - text: 0 Results 0 Mentors 0 Students 0 Courses
- region "Notifications alt+T"
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | 
  3  | test.describe("Messaging workflow", () => {
  4  |   test("user can navigate to messages and verify list or send a message", async ({
  5  |     page,
  6  |   }) => {
  7  |     // Navigate to messages page
  8  |     await page.goto("/messages");
  9  | 
  10 |     // Verify main header
  11 |     await expect(page.locator("h2", { hasText: "Messages" })).toBeVisible();
  12 | 
  13 |     const emptyStateText = page.locator("text=No conversations found.");
  14 |     const conversationThread = page.locator("button:has-text('Messages') ~ div button"); // matches buttons in list
  15 | 
  16 |     // Wait for empty state or conversation list
  17 |     await expect(
  18 |       emptyStateText.or(page.locator("aside button")).first()
  19 |     ).toBeVisible({ timeout: 8000 });
  20 | 
  21 |     const firstThread = page.locator("aside button").first();
  22 |     if (await firstThread.isVisible()) {
  23 |       // Select the first thread
  24 |       await firstThread.click();
  25 | 
  26 |       // Check if message input is enabled
  27 |       const input = page.locator("input[placeholder='Type a message...']");
> 28 |       await expect(input).toBeVisible();
     |                           ^ Error: expect(locator).toBeVisible() failed
  29 |       
  30 |       if (await input.isEnabled()) {
  31 |         await input.fill("Hey there! Test E2E message.");
  32 |         
  33 |         // Submit message
  34 |         const sendBtn = page.locator("button[type='submit']");
  35 |         await expect(sendBtn).toBeEnabled();
  36 |         await sendBtn.click();
  37 | 
  38 |         // Verify it was rendered in the messages pane
  39 |         await expect(page.locator("text=Hey there! Test E2E message.")).toBeVisible();
  40 |       }
  41 |     }
  42 |   });
  43 | });
  44 | 
```