import { expect, test } from '@playwright/test';

test.describe('coding mode', () => {
	test('sidebar entry opens the coding chat with the interpreter enabled', async ({ page }) => {
		await page.goto('/');
		// The selector auto-opens on a fresh chat; dismiss it so sidebar clicks land.
		await page.keyboard.press('Escape');

		await page.locator('#sidebar-coding-button').click();
		await expect(page).toHaveURL(/\/coding$/);

		// The preset turns the code interpreter on for chats started here.
		const interpreter = page.locator(
			'[aria-label="Disable Code Interpreter"], button[aria-pressed="true"][aria-label*="Code Interpreter"]'
		);
		await expect(interpreter.first()).toBeVisible({ timeout: 30_000 });
		await expect(interpreter.first()).toHaveAttribute('aria-pressed', 'true');
	});

	test('regular new chat keeps the interpreter off', async ({ page }) => {
		await page.goto('/');
		await page.keyboard.press('Escape');

		const enabledInterpreter = page.locator('button[aria-pressed="true"][aria-label*="Code Interpreter"]');
		await expect(enabledInterpreter).toHaveCount(0);
	});
});
