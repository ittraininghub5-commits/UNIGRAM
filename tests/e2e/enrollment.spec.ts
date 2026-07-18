import { test, expect } from "@playwright/test";

test.describe("Course enrollment workflow", () => {
  test("student can view my courses list or enroll in a new course", async ({
    page,
  }) => {
    // Navigate to courses page
    await page.goto("/courses");

    // Verify page title
    await expect(page.locator("h1", { hasText: "My Courses" })).toBeVisible();

    const emptyStateHeader = page.locator("h3:has-text('No Courses Yet')");
    const courseCard = page.locator(".border.rounded-2xl.p-6");

    await expect(
      emptyStateHeader.or(courseCard).first()
    ).toBeVisible({ timeout: 8000 });

    // If no courses enrolled yet, navigate to search to find and enroll in a course
    if (await emptyStateHeader.isVisible()) {
      const browseBtn = page.getByRole("button", { name: /browse courses/i });
      await expect(browseBtn).toBeVisible();
      await browseBtn.click();

      // We are now on /search page
      await expect(page).toHaveURL(/\/search/);

      // Filter by Courses
      const filterBtn = page.getByRole("button", { name: /^courses$/i });
      await expect(filterBtn).toBeVisible();
      await filterBtn.click();

      // Check if any courses are visible
      const firstCourse = page.locator("div.font-semibold:has-text('Course •')").first();
      
      if (await firstCourse.isVisible({ timeout: 4000 })) {
        await firstCourse.click();

        // We are on /course/:id page
        await expect(page).toHaveURL(/\/course\//);

        // Click Enroll Now button if we aren't enrolled yet
        const enrollBtn = page.getByRole("button", { name: /enroll now/i });
        if (await enrollBtn.isVisible()) {
          await enrollBtn.click();
          // Check that we enrolled and see progress indicators
          await expect(page.locator("text=0%")).toBeVisible();
        }
      } else {
        console.log("No courses found in search results. Skipping enrollment step.");
      }
    }
  });
});
