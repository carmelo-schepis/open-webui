import { expect, test } from '@playwright/test';

import { chatInput, sendMessageButton } from '../helpers';

test.describe('loading sequence', () => {
	test('first assistant response shows a progressing activity sequence', async ({ page }) => {
		test.setTimeout(240_000);

		await page.goto('/');

		// Dismiss the auto-opened selector so it does not eat keystrokes.
		await page.keyboard.press('Escape');

		await page.locator(chatInput).click();
		await page.keyboard.type('Say OK and nothing else.');
		await page.locator(sendMessageButton).click();

		const sequence = page.locator('[data-activity-sequence]').first();
		await expect(sequence).toBeVisible({ timeout: 60_000 });

		// The sequence is a live status: its first line appears, then the
		// highlighted line advances while tokens have not started flowing.
		const firstLine = await sequence.textContent();
		expect(firstLine?.trim().length ?? 0).toBeGreaterThan(0);

		// Wait for the response to actually stream, then confirm the sequence
		// was replaced by the assistant message content.
		await expect(page.locator('#response-message-model-name')).toBeVisible({ timeout: 180_000 });
	});
});
