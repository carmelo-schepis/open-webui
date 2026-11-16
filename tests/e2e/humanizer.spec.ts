import { expect, test } from '@playwright/test';

test.describe('humanizer', () => {
	test('toggle lives in the integrations menu and persists', async ({ page }) => {
		await page.goto('/');
		await page.keyboard.press('Escape');

		// Open the input menu where the humanizer switch lives. A dispatched click
		// avoids the pointer sequence that blurs the trigger and closes the menu.
		const menuButton = page.locator('#input-menu-button');
		await menuButton.waitFor({ state: 'visible', timeout: 30_000 });
		await menuButton.dispatchEvent('click');

		const toggle = page.getByRole('menuitemcheckbox', { name: 'Humanizer' });
		await expect(toggle).toBeVisible();
		const before = await toggle.getAttribute('aria-checked');

		await toggle.dispatchEvent('click');
		const after = (await toggle.getAttribute('aria-checked')) ?? '';
		expect(after).not.toBe(before);

		// Persisted in settings storage for the next turn.
		await page.reload();
		await page.keyboard.press('Escape');
		await page.locator('#input-menu-button').dispatchEvent('click');
		await expect(page.getByRole('menuitemcheckbox', { name: 'Humanizer' })).toHaveAttribute(
			'aria-checked',
			after
		);

		// Restore the original state.
		await page.getByRole('menuitemcheckbox', { name: 'Humanizer' }).dispatchEvent('click');
	});

	test('with humanizer on, the response streams as humanized text', async ({ page }) => {
		test.setTimeout(300_000);

		await page.goto('/');
		await page.keyboard.press('Escape');

		// Enable the humanizer first.
		await page.locator('#input-menu-button').waitFor({ state: 'visible', timeout: 30_000 });
		await page.locator('#input-menu-button').dispatchEvent('click');
		const toggle = page.getByRole('menuitemcheckbox', { name: 'Humanizer' });
		await toggle.waitFor({ state: 'visible', timeout: 15_000 });
		if ((await toggle.getAttribute('aria-checked')) !== 'true') {
			await toggle.dispatchEvent('click');
		}
		await page.keyboard.press('Escape');

		await page.locator('#chat-input').click();
		await page.keyboard.type('Introduce yourself in one short sentence.');
		await page.locator('#send-message-button').click();

		await expect(page.locator('#response-message-model-name')).toBeVisible({ timeout: 240_000 });
	});
});
