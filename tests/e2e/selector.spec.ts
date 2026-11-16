import { expect, test } from '@playwright/test';

import { selectModelButton } from '../helpers';

test.describe('model selector', () => {
	test('selector auto-opens once on a brand-new chat', async ({ page }) => {
		await page.goto('/');

		const trigger = page.locator(selectModelButton()).first();
		await expect(trigger).toBeVisible();

		// One-shot auto-open: expanded right after load.
		await expect(trigger).toHaveAttribute('aria-expanded', 'true', { timeout: 20_000 });
		await expect(page.locator('[aria-label="Search In Models"]')).toBeVisible();
	});

	test('models group under their server connection with headings', async ({ page }) => {
		await page.goto('/');
		const trigger = page.locator(selectModelButton()).first();
		await expect(trigger).toHaveAttribute('aria-expanded', 'true', { timeout: 20_000 });

		// Both configured Ollama servers surface as group headings.
		const headings = page.locator('[data-server-heading]');
		await expect(headings.first()).toBeVisible({ timeout: 20_000 });
		const texts = await headings.allTextContents();
		expect(texts.length).toBeGreaterThanOrEqual(2);
	});

	test('server aliases rename the group heading and persist', async ({ page }) => {
		await page.addInitScript(() => {
			localStorage.setItem(
				'hugo.serverAliases',
				JSON.stringify({ 'http://100.84.10.124:11434': 'Lab Alpha' })
			);
		});
		await page.goto('/');

		const trigger = page.locator(selectModelButton()).first();
		await expect(trigger).toHaveAttribute('aria-expanded', 'true', { timeout: 20_000 });

		await expect(page.locator('[data-server-heading]', { hasText: 'Lab Alpha' })).toBeVisible({
			timeout: 20_000
		});
	});
});
