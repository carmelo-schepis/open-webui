import fs from 'node:fs';
import path from 'node:path';

import { test as setup } from '@playwright/test';

import { authStatePath, signIn } from './helpers';

setup('authenticate as admin', async ({ request }) => {
	const token = await signIn(request);

	// Mark the changelog as read server-side so the "What's New" modal never
	// blocks pointer interactions in tests.
	const config = await request.get('/api/config').then((res) => res.json().catch(() => ({})));
	const version = String(config?.version ?? '');
	if (version) {
		await request.post('/api/v1/users/user/settings/update', {
			headers: { Authorization: `Bearer ${token}` },
			data: {
				ui: {
					version,
					showChangelog: false
				}
			}
		});
	}

	fs.mkdirSync(path.dirname(authStatePath), { recursive: true });
	fs.writeFileSync(
		authStatePath,
		JSON.stringify({
			cookies: [],
			origins: [
				{
					origin: process.env.HARNESS_BASE_URL ?? 'http://localhost:5173',
					localStorage: [
						{ name: 'token', value: token },
						// Desktop sidebar starts expanded for every test.
						{ name: 'sidebar', value: 'true' },
						// Show the chat input selection buttons (web search, code
						// interpreter, humanizer) that the harness features target.
						{ name: 'settings', value: JSON.stringify({ showInputSelections: true }) }
					]
				}
			]
		})
	);
});
