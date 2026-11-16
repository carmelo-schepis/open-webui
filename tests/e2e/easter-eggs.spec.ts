import { expect, test } from '@playwright/test';

test.describe('easter eggs', () => {
	test('typing "hugo" opens the credits dialog', async ({ page }) => {
		await page.goto('/');
		await page.keyboard.press('Escape');

		// Wait for hydration, then click a neutral spot — the chat input auto-focuses
		// and the keydown handler ignores editable targets.
		await page.locator('#sidebar-webui-name').waitFor({ state: 'visible', timeout: 30_000 });
		await page.mouse.click(700, 700);
		await page.keyboard.type('hugo', { delay: 40 });

		const dialog = page.locator('[role="dialog"][aria-label="HUGO"]');
		await expect(dialog).toBeVisible();
		await expect(dialog.getByText('This was created by Carmelo Schepis')).toBeVisible();

		await page.keyboard.press('Escape');
		await expect(dialog).toBeHidden();
	});

	test('seven quick logo clicks also trigger the easter egg', async ({ page }) => {
		await page.goto('/');

		// The sidebar logo counts seven quick clicks within four seconds —
		// raw mouse clicks beat locator-click actionability checks.
		const logo = page.locator('img.sidebar-new-chat-icon').first();
		await logo.waitFor({ state: 'visible', timeout: 30_000 });
		const box = await logo.boundingBox();
		for (let i = 0; i < 7; i++) {
			await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
		}

		await expect(page.getByText('This was created by Carmelo Schepis')).toBeVisible();
	});

	test('the About settings tab credits the creator', async ({ page }) => {
		// The settings modal opens directly via the ?settings= deep link.
		await page.goto('/?settings=about');

		const aboutTab = page.getByRole('tab', { name: 'About' }).or(page.getByText('About', { exact: true }));
		await aboutTab.first().click();

		await expect(page.getByText('This was created by Carmelo Schepis')).toBeVisible();
	});
});
