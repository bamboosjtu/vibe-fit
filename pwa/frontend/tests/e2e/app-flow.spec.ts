import { expect, test } from '@playwright/test';
import { applyFirstTemplate, collectPageIssues, expectNoPageIssues, resetBrowserState } from './helpers';

test.beforeEach(async ({ page }) => {
  await resetBrowserState(page);
});

test('app shell routes render without browser errors', async ({ page }) => {
  const issues = collectPageIssues(page);

  const routes = [
    { path: '/today', text: '今日训练' },
    { path: '/plans', text: '训练计划' },
    { path: '/history', text: '训练历史记录' },
    { path: '/settings', text: '设置' },
  ];

  for (const route of routes) {
    await page.goto(route.path);
    await expect(page.getByText(route.text).first()).toBeVisible();
  }

  await expectNoPageIssues(issues);
});

test('template can be applied and today page shows the plan', async ({ page }) => {
  const issues = collectPageIssues(page);

  await page.goto('/today');
  await expect(page.getByRole('heading', { name: '今日训练' })).toBeVisible();
  await applyFirstTemplate(page);

  await page.getByTestId('nav-today').click();
  await expect(page).toHaveURL(/\/today$/);
  await expect(page.getByText('背 + 肩后束 + 肱二头')).toBeVisible();
  await expect(page.getByTestId(/add-exercise-/).first()).toBeVisible();

  await expectNoPageIssues(issues);
});

test('workout flow adds an exercise, edits sets, starts rest timer, and writes history', async ({ page }) => {
  const issues = collectPageIssues(page);

  await page.goto('/today');
  await applyFirstTemplate(page);
  await page.getByTestId('nav-today').click();

  await page.getByTestId(/add-exercise-/).first().click();
  await expect(page.getByRole('dialog', { name: '选择动作' })).toBeVisible();
  await page.getByTestId('exercise-search-input').getByRole('textbox').fill('高位下拉');
  await page.getByTestId('exercise-option-lat-pulldown').click();

  await expect(page.getByTestId('exercise-card-lat-pulldown')).toBeVisible();
  await page.getByTestId('set-1-weight-input').getByRole('spinbutton').fill('55');
  await page.getByTestId('set-1-reps-input').getByRole('spinbutton').fill('10');
  await page.getByTestId('copy-last-set-button').click();
  await page.getByTestId('add-set-button').click();
  await page.getByTestId('set-1-complete-button').click();
  await expect(page.getByText('休息中')).toBeVisible();

  await page.getByTestId('rest-timer-close-button').click();
  await expect(page.getByText('休息中')).toBeHidden();
  await page.getByTestId('end-training-button').click();
  await expect(page.getByRole('heading', { name: '今日训练' })).toBeVisible();

  await page.getByTestId('nav-history').click();
  await expect(page).toHaveURL(/\/history$/);
  await expect(page.getByText('背 + 肩后束 + 肱二头').first()).toBeVisible();
  await page.getByText('背 + 肩后束 + 肱二头').first().click();
  await expect(page.getByRole('dialog')).toContainText('高位下拉');

  await expectNoPageIssues(issues);
});

test('settings page supports unauthenticated state and data export', async ({ page }) => {
  const issues = collectPageIssues(page);

  await page.goto('/settings');
  await expect(page.getByText('账户与同步')).toBeVisible();
  await expect(page.getByTestId('go-login-button')).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('export-data-button').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^vibefit-backup-\d{4}-\d{2}-\d{2}\.json$/);

  await expectNoPageIssues(issues);
});
