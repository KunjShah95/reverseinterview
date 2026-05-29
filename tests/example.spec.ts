import { test, expect } from '@playwright/test';

test('homepage loads and has body', async ({ page }) => {
  const response = await page.goto('/');
  expect(response && response.ok()).toBeTruthy();
  await expect(page.locator('body')).toBeVisible();
});
