import { test, expect } from '@playwright/test';

test.describe('ScrapeLeads Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should load dashboard with correct title', async ({ page }) => {
    await expect(page).toHaveTitle('ScrapeLeads — Verified business leads, ready to sell');
  });

  test('should display hero section with headline', async ({ page }) => {
    const hero = page.locator('.hero-copy h1');
    await expect(hero).toBeVisible();
    await expect(hero).toContainText('Build a verified lead list');
  });

  test('should have navigation sidebar with 4 items', async ({ page }) => {
    const navItems = page.locator('.nav-item');
    await expect(navItems).toHaveCount(4);
    await expect(navItems.nth(0)).toContainText('New scrape');
    await expect(navItems.nth(1)).toContainText('Lead runs');
    await expect(navItems.nth(2)).toContainText('Integrations');
    await expect(navItems.nth(3)).toContainText('Settings');
  });

  test('should navigate between views', async ({ page }) => {
    await page.click('[data-view="runs"]');
    await expect(page.locator('#runs.view.active')).toBeVisible();

    await page.click('[data-view="integrations"]');
    await expect(page.locator('#integrations.view.active')).toBeVisible();

    await page.click('[data-view="settings"]');
    await expect(page.locator('#settings.view.active')).toBeVisible();

    await page.click('[data-view="dashboard"]');
    await expect(page.locator('#dashboard.view.active')).toBeVisible();
  });

  test('should validate required fields on step 1', async ({ page }) => {
    await page.clear('#industry');
    await page.clear('#location');
    await page.click('#nextBtn');
    const toast = page.locator('#toast.show');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('Industry and location are required');
  });

  test('should progress through wizard steps', async ({ page }) => {
    await page.fill('#industry', 'Dentists');
    await page.fill('#location', 'Mumbai, India');
    await page.click('#nextBtn');
    await expect(page.locator('.form-page[data-page="2"].active')).toBeVisible();

    await page.click('#nextBtn');
    await expect(page.locator('.form-page[data-page="3"].active')).toBeVisible();

    await page.click('#nextBtn');
    await expect(page.locator('.form-page[data-page="4"].active')).toBeVisible();
  });

  test('should toggle source checkboxes', async ({ page }) => {
    await page.click('[data-source="Yelp"] .source');
    await expect(page.locator('[data-source="Yelp"]').locator('.source')).toHaveClass(/checked/);

    await page.click('[data-source="Yelp"] .source');
    await expect(page.locator('[data-source="Yelp"]').locator('.source')).not.toHaveClass(/checked/);
  });

  test('should add custom criteria', async ({ page }) => {
    await page.click('#nextBtn');
    await page.click('#nextBtn');
    const initialCount = await page.locator('.criterion').count();
    await page.click('#addCriteria');
    await expect(page.locator('.criterion')).toHaveCount(initialCount + 1);
  });

  test('should remove custom criteria', async ({ page }) => {
    await page.click('#nextBtn');
    await page.click('#nextBtn');
    await page.click('.criterion .remove');
    await expect(page.locator('.criterion')).toHaveCount(2);
  });

  test('should save draft to localStorage', async ({ page }) => {
    await page.fill('#industry', 'SaaS');
    await page.fill('#location', 'Helsinki, Finland');
    await page.fill('#email', 'test@example.com');
    await page.click('#saveDraft');
    const toast = page.locator('#toast.show');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText('Draft saved');
  });

  test('should open job modal on start scraping', async ({ page }) => {
    await page.fill('#industry', 'Dentists');
    await page.fill('#location', 'Mumbai, India');
    await page.fill('#email', 'test@example.com');
    await page.click('#nextBtn');
    await page.click('#nextBtn');
    await page.click('#nextBtn');
    await page.click('#nextBtn');
    await expect(page.locator('#jobModal[aria-hidden="false"]')).toBeVisible();
  });

  test('should download CSV from runs view', async ({ page }) => {
    await page.click('[data-view="runs"]');
    const downloadPromise = page.waitForEvent('download');
    await page.click('.download-small');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('scrape-leads-demo.csv');
  });

  test('should display stats on runs page', async ({ page }) => {
    await page.click('[data-view="runs"]');
    await expect(page.locator('.stats article')).toHaveCount(4);
    await expect(page.locator('.stats article').first()).toContainText('Total leads');
  });

  test('should show integration cards', async ({ page }) => {
    await page.click('[data-view="integrations"]');
    await expect(page.locator('.integration-grid article')).toHaveCount(6);
  });

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await expect(page.locator('.mobile-menu')).toBeVisible();
    await page.click('.mobile-menu');
    await expect(page.locator('.sidebar.open')).toBeVisible();
  });
});

test.describe('Accessibility', () => {
  test('should have proper ARIA attributes', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#jobModal')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('.nav-item')).toHaveAttribute('data-view');
  });

  test('should have focusable elements', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement.tagName);
    expect(['BUTTON', 'INPUT', 'SELECT', 'A']).toContain(focused);
  });
});