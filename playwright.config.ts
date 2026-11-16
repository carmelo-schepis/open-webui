import { defineConfig, devices } from '@playwright/test';

const PORT = 5173;
const baseURL = process.env.HARNESS_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
	testDir: './tests',
	timeout: 90_000,
	expect: { timeout: 15_000 },
	fullyParallel: false,
	workers: 1,
	retries: 0,
	reporter: [['list'], ['html', { open: 'never' }]],
	use: {
		baseURL,
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
		viewport: { width: 1440, height: 900 },
		locale: 'en-US',
		timezoneId: 'UTC'
	},
	projects: [
		{
			name: 'auth',
			testMatch: /auth\.setup\.ts/
		},
		{
			name: 'chromium',
			use: {
				...devices['Desktop Chrome'],
				storageState: 'tests/.auth/admin.json',
				// Above the app's mobile breakpoint (768px) so the desktop sidebar
				// renders interactive instead of inert.
				viewport: { width: 1440, height: 900 }
			},
			dependencies: ['auth']
		}
	],
	webServer: process.env.HARNESS_NO_WEB_SERVER
		? undefined
		: {
				url: baseURL,
				reuseExistingServer: true,
				timeout: 120_000
			}
});
