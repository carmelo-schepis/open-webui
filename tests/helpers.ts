export const BASE_URL = process.env.HARNESS_BASE_URL ?? 'http://localhost:5173';

export const ADMIN_EMAIL = 'hugo@harness.local';
export const ADMIN_PASSWORD = 'hugo-harness-test-2026';

export const RESEARCH_QUERY = 'What is Ollama?';

export const authStatePath = 'tests/.auth/admin.json';

export const selectModelButton = () =>
	`[id^="model-selector-"][id$="-button"]`;

export const newChatButton = 'a#sidebar-new-chat-button';
export const sendMessageButton = '#send-message-button';
export const chatInput = '#chat-input';

export const signIn = async (request: import('@playwright/test').APIRequestContext) => {
	const res = await request.post('/api/v1/auths/signin', {
		data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }
	});
	if (!res.ok()) {
		throw new Error(`Sign-in failed with HTTP ${res.status()}`);
	}
	const body = await res.json();
	return body.token as string;
};
