# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: example.spec.ts >> homepage loads and has body
- Location: tests\example.spec.ts:3:1

# Error details

```
Error: page.goto: net::ERR_NETWORK_CHANGED at http://localhost:5180/
Call log:
  - navigating to "http://localhost:5180/", waiting until "load"

```

# Test source

```ts
  1 | import { test, expect } from '@playwright/test';
  2 | 
  3 | test('homepage loads and has body', async ({ page }) => {
> 4 |   const response = await page.goto('/');
    |                               ^ Error: page.goto: net::ERR_NETWORK_CHANGED at http://localhost:5180/
  5 |   expect(response && response.ok()).toBeTruthy();
  6 |   await expect(page.locator('body')).toBeVisible();
  7 | });
  8 | 
```