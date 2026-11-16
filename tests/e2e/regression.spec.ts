import { expect, test } from '@playwright/test';

test.describe('regression', () => {
	test('sidebar menu entries navigate to their pages', async ({ page }) => {
		await page.goto('/');

		await page.locator('#sidebar-notes-button').click();
		await expect(page).toHaveURL(/\/notes/);

		await page.locator('#sidebar-workspace-button').click();
		await expect(page).toHaveURL(/\/workspace/);
	});

	test('home page boots without client errors', async ({ page }) => {
		const pageErrors: string[] = [];
		page.on('pageerror', (error) => pageErrors.push(error.message));

		await page.goto('/');
		// The hidden focus-proxy button shares this id; the visible link is the anchor.
		await page.locator('a#sidebar-new-chat-button').waitFor({ state: 'visible', timeout: 30_000 });

		expect(pageErrors).toEqual([]);
	});

	test('workspace, notes, and playground routes all render', async ({ page }) => {
		for (const route of ['/workspace', '/notes', '/playground']) {
			const pageErrors: string[] = [];
			page.on('pageerror', (error) => pageErrors.push(error.message));

			await page.goto(route);
			await expect(page.locator('body')).not.toContainText('Internal Server Error');
			expect(pageErrors).toEqual([]);
		}
	});
});
