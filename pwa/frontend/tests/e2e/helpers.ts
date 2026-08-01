import { expect, type Page } from '@playwright/test';

export async function resetBrowserState(page: Page) {
  await page.route('https://accounts.google.com/gsi/client', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: '',
    });
  });

  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  await page.goto('/');
  await page.evaluate(async () => {
    await Promise.all((await navigator.serviceWorker?.getRegistrations?.() ?? []).map((registration) => registration.unregister()));
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase('VibeFitDB');
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    });
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
}

export function collectPageIssues(page: Page) {
  const issues: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      issues.push(`[${message.type()}] ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    issues.push(`[pageerror] ${error.message}`);
  });
  page.on('requestfailed', (request) => {
    const failure = request.failure();
    issues.push(`[requestfailed] ${request.url()} ${failure?.errorText ?? ''}`.trim());
  });
  return issues;
}

export async function expectNoPageIssues(issues: string[]) {
  expect(issues).toEqual([]);
}

export async function applyFirstTemplate(page: Page) {
  await page.getByTestId('nav-plans').click();
  await expect(page).toHaveURL(/\/plans$/);
  await page.getByTestId('template-card-0').click();
  await expect(page.getByRole('dialog', { name: '应用训练计划' })).toBeVisible();
  await page.getByTestId('apply-template-button').click();
  await expect(page.getByRole('dialog', { name: '应用训练计划' })).toBeHidden();
}
