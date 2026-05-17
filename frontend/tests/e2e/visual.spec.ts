import { expect, test } from '@playwright/test';
import { applyFirstTemplate, resetBrowserState } from './helpers';

const viewports = [
  { width: 390, height: 844 },
  { width: 360, height: 740 },
  { width: 430, height: 932 },
];

const pages = [
  { path: '/today', name: 'today' },
  { path: '/plans', name: 'plans' },
  { path: '/history', name: 'history' },
  { path: '/settings', name: 'settings' },
];

test.beforeEach(async ({ page }) => {
  await resetBrowserState(page);
  await applyFirstTemplate(page);
});

for (const viewport of viewports) {
  for (const target of pages) {
    test(`visual baseline ${target.name} ${viewport.width}x${viewport.height}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(target.path);
      await expect(page.getByRole('main').or(page.locator('body'))).toBeVisible();
      await expect(page).toHaveScreenshot(`${target.name}-${viewport.width}x${viewport.height}.png`, {
        fullPage: false,
      });
    });
  }
}
