import { expect, test } from '@playwright/test';

test.describe('uptime', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		// Dismiss the auto-opened selector so it does not cover the sidebar.
		await page.keyboard.press('Escape');
	});

	test('admin sidebar shows an uptime section with both servers', async ({ page }) => {
		const section = page.locator('#sidebar-uptime-content');
		await expect(section).toBeVisible({ timeout: 30_000 });

		// Both configured Ollama connections are listed.
		await expect(section.getByText('100.84.10.124:11434')).toBeVisible({ timeout: 30_000 });
		await expect(section.getByText('100.126.194.51:11434')).toBeVisible({ timeout: 30_000 });
	});

	test('probe results persist to the hugo.uptime store', async ({ page }) => {
		await page.locator('#sidebar-uptime-content').waitFor({ state: 'visible', timeout: 30_000 });

		const store = await page.waitForFunction(
			() => {
				try {
					const parsed = JSON.parse(localStorage.getItem('hugo.uptime') ?? '{}');
					return Object.keys(parsed).length > 0 ? parsed : null;
				} catch {
					return null;
				}
			},
			{ timeout: 30_000 }
		);
		const value = await store.jsonValue();
		const urls = Object.keys(value as Record<string, unknown>);
		expect(urls.some((url) => url.includes('11434'))).toBe(true);
	});
});
