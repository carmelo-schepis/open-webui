export const RESEARCH_SERVICE_URL_KEY = 'hugo.researchServiceUrl';
export const DEFAULT_RESEARCH_SERVICE_URL = 'http://127.0.0.1:8787';

export type ResearchSource = { url: string; title: string };

export type ResearchEvent =
	| { type: 'started'; query: string }
	| { type: 'searching'; query: string }
	| { type: 'source_found'; source: ResearchSource }
	| { type: 'reading'; source: ResearchSource }
	| { type: 'note'; source: ResearchSource; content: string }
	| { type: 'analyzing'; message: string }
	| { type: 'writing' }
	| { type: 'report_chunk'; content: string }
	| { type: 'completed'; report: string; sources: ResearchSource[] }
	| { type: 'error'; message: string };

const normalizeUrl = (url: string): string => url.trim().replace(/\/+$/, '');

export const getResearchServiceUrl = (): string => {
	try {
		return normalizeUrl(localStorage.getItem(RESEARCH_SERVICE_URL_KEY) ?? '') || DEFAULT_RESEARCH_SERVICE_URL;
	} catch {
		return DEFAULT_RESEARCH_SERVICE_URL;
	}
};

export const setResearchServiceUrl = (url: string): void => {
	try {
		const value = normalizeUrl(url);
		if (value) {
			localStorage.setItem(RESEARCH_SERVICE_URL_KEY, value);
		} else {
			localStorage.removeItem(RESEARCH_SERVICE_URL_KEY);
		}
	} catch {
		// storage unavailable — in-memory callers still work
	}
};

export type StreamResearchOptions = {
	model?: string;
	signal?: AbortSignal;
	onEvent: (event: ResearchEvent) => void;
};

/** POST the query and relay each NDJSON research event to `onEvent`. */
export const streamResearch = async (query: string, options: StreamResearchOptions): Promise<void> => {
	const { model, signal, onEvent } = options;

	const res = await fetch(`${getResearchServiceUrl()}/research`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ query, ...(model ? { model } : {}) }),
		signal
	});

	if (!res.ok) {
		throw new Error(`Research service returned ${res.status}`);
	}
	if (!res.body) {
		throw new Error('Research service returned no event stream');
	}

	const reader = res.body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += decoder.decode(value, { stream: true });

		let newlineIdx;
		while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
			const line = buffer.slice(0, newlineIdx).trim();
			buffer = buffer.slice(newlineIdx + 1);
			if (!line) continue;
			try {
				onEvent(JSON.parse(line) as ResearchEvent);
			} catch {
				// ignore malformed lines from the companion service
			}
		}
	}
};
