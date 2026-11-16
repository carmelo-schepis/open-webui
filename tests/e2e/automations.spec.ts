import { expect, test } from '@playwright/test';

test.describe('automations', () => {
	test('sidebar automations entry navigates to the automations page', async ({ page }) => {
		await page.goto('/');
		await page.keyboard.press('Escape');

		await page.locator('#sidebar-automations-button').click();

		await expect(page).toHaveURL(/\/automations/);
		await expect(page.getByText('Automations', { exact: true }).first()).toBeVisible();
	});

	test('automations page renders its toolbar without errors', async ({ page }) => {
		const pageErrors: string[] = [];
		page.on('pageerror', (error) => pageErrors.push(error.message));

		await page.goto('/automations');
		await expect(page.getByPlaceholder(/Search Automations/i)).toBeVisible({ timeout: 30_000 });

		expect(pageErrors).toEqual([]);
	});
});
