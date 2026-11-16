import { expect, test } from '@playwright/test';

test.describe('xai theme', () => {
	test.beforeEach(async ({ page }) => {
		await page.addInitScript(() => {
			localStorage.setItem('theme', 'dark');
		});
		await page.goto('/');
		await expect(page.locator('html')).toHaveClass(/dark/);
		// Vite injects app.css from JS modules after `load`; wait for styles.
		await page.waitForFunction(() => getComputedStyle(document.body).backgroundColor !== 'rgba(0, 0, 0, 0)');
	});

	test('dark mode applies and canvas surfaces use the #0a0a0a palette', async ({ page }) => {
		const palette = await page.evaluate(() => {
			const probe = (className: string) => {
				const el = document.createElement('div');
				el.className = className;
				document.body.appendChild(el);
				const bg = getComputedStyle(el).backgroundColor;
				el.remove();
				return bg;
			};
			return {
				canvas: probe('bg-gray-900'),
				card: probe('bg-gray-850'),
				deepest: probe('dark:bg-gray-950')
			};
		});

		expect(palette.canvas).toBe('rgb(10, 10, 10)');
		expect(palette.card).toBe('rgb(25, 25, 25)');
		expect(palette.deepest).toBe('rgb(6, 6, 6)');
	});

	test('hugo design tokens carry the xai accents', async ({ page }) => {
		const tokens = await page.evaluate(() => {
			const styles = getComputedStyle(document.documentElement);
			return {
				canvas: styles.getPropertyValue('--hugo-canvas').trim(),
				card: styles.getPropertyValue('--hugo-card').trim(),
				sunset: styles.getPropertyValue('--hugo-sunset').trim(),
				dusk: styles.getPropertyValue('--hugo-dusk').trim()
			};
		});

		expect(tokens.canvas).toBe('#0a0a0a');
		expect(tokens.card).toBe('#191919');
		expect(tokens.sunset).toBe('#ff7a17');
		expect(tokens.dusk).toBe('#7c3aed');
	});

	test('surfaces are flat: large shadows render as nothing', async ({ page }) => {
		const shadow = await page.evaluate(() => {
			const el = document.createElement('div');
			el.className = 'shadow-lg';
			document.body.appendChild(el);
			const value = getComputedStyle(el).boxShadow;
			el.remove();
			return value;
		});
		expect(shadow.replace(/\s+/g, ' ')).toMatch(/rgba\(0, 0, 0, 0\) 0px 0px|^none$/);
	});
});
