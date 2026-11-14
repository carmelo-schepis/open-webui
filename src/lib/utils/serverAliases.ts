import { get, writable } from 'svelte/store';
import { OLLAMA_API_BASE_URL } from '$lib/constants';
import { getOllamaConfig } from '$lib/apis/ollama';

export const SERVER_ALIASES_KEY = 'hugo.serverAliases';

export type ServerAliases = Record<string, string>;

export type OllamaServer = {
	idx: number;
	url: string;
	/** null = unknown (e.g. non-admin users cannot probe connections) */
	online: boolean | null;
};

/** Normalise a connection base URL so alias lookups are stable. */
export const normalizeServerUrl = (url: string | null | undefined): string =>
	(url ?? '').trim().replace(/\/+$/, '');

export const hostFromUrl = (url: string): string => {
	try {
		return new URL(url).host || url;
	} catch {
		return url;
	}
};

const readAliases = (): ServerAliases => {
	try {
		const raw = localStorage.getItem(SERVER_ALIASES_KEY);
		const parsed = raw ? JSON.parse(raw) : {};
		if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
			return Object.fromEntries(
				Object.entries(parsed).filter(([, value]) => typeof value === 'string')
			) as ServerAliases;
		}
	} catch {
		// storage unavailable or corrupt — behave as if no aliases are set
	}
	return {};
};

export const serverAliases = writable<ServerAliases>(readAliases());

if (typeof window !== 'undefined') {
	// Keep other tabs in sync.
	window.addEventListener('storage', (event) => {
		if (event.key === SERVER_ALIASES_KEY) serverAliases.set(readAliases());
	});
}

export const getServerAlias = (url: string, aliases: ServerAliases = get(serverAliases)): string =>
	(aliases[normalizeServerUrl(url)] ?? '').trim();

export const setServerAlias = (url: string, alias: string) => {
	const key = normalizeServerUrl(url);
	if (!key) return;

	const next = { ...readAliases() };
	const value = alias.trim();
	if (value) {
		next[key] = value;
	} else {
		delete next[key];
	}

	try {
		localStorage.setItem(SERVER_ALIASES_KEY, JSON.stringify(next));
	} catch {
		// ignore quota / privacy-mode failures; the in-memory store still updates
	}
	serverAliases.set(next);
};

/** Heading text: user alias if set, else host. */
export const getServerLabel = (
	server: Pick<OllamaServer, 'url' | 'idx'>,
	aliases: ServerAliases
): string => {
	if (!server.url) return `Server ${server.idx + 1}`;
	return getServerAlias(server.url, aliases) || hostFromUrl(server.url);
};

export const ollamaServers = writable<OllamaServer[]>([]);

const probeServer = async (token: string, idx: number): Promise<boolean> => {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), 4000);
	try {
		const res = await fetch(`${OLLAMA_API_BASE_URL}/api/version/${idx}`, {
			signal: controller.signal,
			headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }
		});
		return res.ok;
	} catch {
		return false;
	} finally {
		clearTimeout(timer);
	}
};

/**
 * Loads the configured Ollama connections and their reachability.
 * Connection URLs and per-connection probes are admin-only on the backend;
 * for other users this resolves to an empty list and the selector falls back
 * to index-based headings.
 */
export const loadOllamaServers = async (token: string, isAdmin: boolean) => {
	if (!isAdmin) return;

	const config = await getOllamaConfig(token).catch(() => null);
	const urls: string[] = config?.OLLAMA_BASE_URLS ?? [];
	if (!config?.ENABLE_OLLAMA_API || urls.length === 0) {
		ollamaServers.set([]);
		return;
	}

	// Publish URLs immediately, then fill in reachability.
	ollamaServers.set(urls.map((url, idx) => ({ idx, url, online: null })));
	const status = await Promise.all(urls.map((_, idx) => probeServer(token, idx)));
	ollamaServers.set(urls.map((url, idx) => ({ idx, url, online: status[idx] })));
};
