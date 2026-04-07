import { expect, test } from '@playwright/test';

test('landing page has title and sign-in link', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('h1')).toHaveText('Lavender');
	await expect(page.locator('a[href="/auth/login"]')).toBeVisible();
});

test('sign-in link navigates to login page', async ({ page }) => {
	await page.goto('/');
	await page.click('a[href="/auth/login"]');
	await expect(page).toHaveURL('/auth/login');
});

test('unauthenticated user visiting /app is redirected to login', async ({ page }) => {
	await page.goto('/app');
	await expect(page).toHaveURL(/\/auth\/login/);
});
