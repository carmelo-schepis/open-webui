import { expect, test } from '@playwright/test';

test.describe('rebrand', () => {
	test('document title is HUGO Harness', async ({ page }) => {
		await page.goto('/');
		await expect(page).toHaveTitle('HUGO Harness');
	});

	test('dark theme-color meta matches the xAI canvas', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#0a0a0a');
	});

	test('backend reports the rebranded app name', async ({ request }) => {
		const res = await request.get('/api/config');
		expect(res.ok()).toBeTruthy();
		const config = await res.json();
		// The backend appends its fork lineage to the name; the brand is the prefix.
		expect(String(config?.name ?? config?.ui?.name)).toMatch(/^HUGO Harness/);
	});

	test('splash branding uses the hugo logo asset', async ({ page }) => {
		await page.goto('/');
		await expect(page.locator('#logo-her')).toHaveAttribute('src', /splash\.png/);
	});
});
