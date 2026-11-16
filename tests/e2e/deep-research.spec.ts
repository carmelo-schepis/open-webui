import { expect, test } from '@playwright/test';

import { RESEARCH_QUERY } from '../helpers';

test.describe('deep research', () => {
	test('page loads and reports companion service status', async ({ page }) => {
		await page.goto('/deep-research');

		await expect(page.getByRole('heading', { name: 'Deep Research' })).toBeVisible();
		await expect(page.getByText(/Service (online|offline)/)).toBeVisible();
	});

	test('runs a query and streams the report pipeline', async ({ page }) => {
		test.setTimeout(300_000);

		// Pin the small Ollama model: report synthesis on the 64k-context model
		// is too slow for the harness window.
		await page.addInitScript(() => {
			sessionStorage.setItem('selectedModels', JSON.stringify(['qwen3.5:2b']));
		});
		await page.goto('/deep-research');
		await page.locator('#deep-research-query').fill(RESEARCH_QUERY);
		await page.getByRole('button', { name: 'Research', exact: true }).click();

		// Sources appear as they are found.
		await expect(page.getByText(/Sources \(\d+\)/)).toBeVisible({ timeout: 120_000 });

		// The report renders, either chunk-streamed or from the completed event.
		await expect(page.getByText('Report', { exact: true })).toBeVisible({ timeout: 240_000 });

		// The run ends in a terminal phase.
		await expect(
			page.getByText(/Done —|Completed|error|failed|unreachable/i).first()
		).toBeVisible({ timeout: 240_000 });
	});
});
