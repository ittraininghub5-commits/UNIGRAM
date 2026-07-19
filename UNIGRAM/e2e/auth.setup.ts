import { test as setup, expect } from '@playwright/test';
import { STORAGE_STATE } from '../playwright.config';

setup('authenticate', async ({ page }) => {
  const email = process.env.PLAYWRIGHT_TEST_USER_EMAIL || 'test-unigram@example.com';
  const password = process.env.PLAYWRIGHT_TEST_USER_PASSWORD || 'TestPass123!';

  console.log(`Setting up authentication for user: ${email}`);

  // Navigate to auth page
  await page.goto('/auth');

  // Verify we are on the auth page
  await expect(page.locator('h1')).toContainText('Unigram');

  // Fill in login details
  const emailInput = page.locator('input[type="email"]');
  const passwordInput = page.locator('input[type="password"]');

  await emailInput.fill(email);
  await passwordInput.fill(password);

  // Click Login button
  const loginButton = page.locator('button:has-text("Login")');
  await loginButton.click();

  // Wait for potential redirection
  try {
    // If login succeeds, it should redirect to /feed or /dashboard
    await page.waitForURL(/\/feed|\/dashboard/, { timeout: 8000 });
    console.log('Login successful.');
  } catch (error) {
    console.log('Login failed, attempting to register test user...');

    // If login failed, it might be because the user doesn't exist. Let's try registering.
    // Refresh auth page to clear state
    await page.goto('/auth');

    // Click "Create Account" toggle button
    await page.locator('button:has-text("Create Account")').click();

    // Fill Full Name
    const fullNameInput = page.locator('input[placeholder="Abishek Joseph"]');
    await fullNameInput.fill('Unigram Test User');

    // Fill Email & Password again
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);

    // Click Sign Up button
    const signUpButton = page.locator('button:has-text("Sign Up")');
    await signUpButton.click();

    // Check if it logged in automatically or redirects
    try {
      await page.waitForURL(/\/feed|\/dashboard/, { timeout: 10000 });
      console.log('Registration and auto-login successful.');
    } catch (regError) {
      console.log('Registration completed, attempting login again...');
      // If we didn't auto-login, toggle back to "Sign In" and log in
      await page.goto('/auth');
      await page.locator('button:has-text("Sign In")').click();
      await page.locator('input[type="email"]').fill(email);
      await page.locator('input[type="password"]').fill(password);
      await page.locator('button:has-text("Login")').click();
      await page.waitForURL(/\/feed|\/dashboard/, { timeout: 10000 });
      console.log('Login after registration successful.');
    }
  }

  // Confirm we have a profile / feed loaded by checking page elements or URL
  await expect(page).toHaveURL(/\/feed|\/dashboard/);

  // Save storage state to be reused by other tests
  await page.context().storageState({ path: STORAGE_STATE });
  console.log('Auth state saved successfully.');
});
