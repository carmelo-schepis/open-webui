/**
 * HUGO Harness companion research service.
 *
 * Port of the Hugo deep-research pipeline. A client POSTs /research with a
 * query and receives newline-delimited JSON research events (the same event
 * family as Hugo's `research-events.ts`): started, searching, source_found,
 * reading, note, analyzing, writing, report_chunk, completed, error.
 *
 * Search runs through DuckDuckGo's HTML endpoints (no API key needed). Pages
 * are fetched, stripped to text, and used as evidence for an Ollama model
 * whose streamed answer is relayed as report_chunk events.
 *
 * Configuration (environment):
 *   PORT               listen port                    (default 8787)
 *   OLLAMA_BASE_URL    Ollama root for synthesis      (default http://127.0.0.1:11434)
 *   OLLAMA_MODEL       fallback synthesis model       (default llama3.2)
 *   ALLOWED_ORIGINS    CORS allow-list, comma sep     (default *, use origin list to restrict)
 *   EVIDENCE_MAX       max sources per run            (default 5)
 *   FETCH_TIMEOUT_MS   per-page fetch timeout         (default 15000)
 */

import http from 'node:http';
import { URL } from 'node:url';

const PORT = Number(process.env.PORT ?? 8787);
const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434').replace(/\/+$/, '');
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'llama3.2';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? '*')
	.split(',')
	.map((origin) => origin.trim())
	.filter(Boolean);
const EVIDENCE_MAX = Number(process.env.EVIDENCE_MAX ?? 5);
const FETCH_TIMEOUT_MS = Number(process.env.FETCH_TIMEOUT_MS ?? 15000);

const MAX_REDIRECTS = 3;

const corsHeaders = (origin) => {
	const allow = ALLOWED_ORIGINS.includes('*') ? '*' : ALLOWED_ORIGINS.includes(origin ?? '') ? origin : null;
	if (!allow) return null;
	return {
		'Access-Control-Allow-Origin': allow,
		'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
		'Access-Control-Allow-Headers': 'Content-Type',
		'Access-Control-Max-Age': '86400'
	};
};

const emit = (res, event) => {
	res.write(`${JSON.stringify(event)}\n`);
};

const fetchWithTimeout = (url, options = {}) => {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
	return fetch(url, {
		redirect: 'follow',
		...options,
		signal: controller.signal,
		headers: {
			'user-agent': 'Mozilla/5.0 (compatible; HugoDeepResearch/1.0; +local)',
			accept: 'text/html,application/xhtml+xml',
			...(options.headers ?? {})
		}
	}).finally(() => clearTimeout(timer));
};

const stripHtml = (html) =>
	html
		.replace(/<script[\s\S]*?<\/script>/gi, ' ')
		.replace(/<style[\s\S]*?<\/style>/gi, ' ')
		.replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
		.replace(/<[^>]+>/g, ' ')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&quot;/g, '"')
		.replace(/&#39;|&apos;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/\s+/g, ' ')
		.trim();

const decodeDdgHref = (href) => {
	if (!href) return null;
	// /l/?uddg=<encoded> results are redirects to the real destination.
	const match = href.match(/[?&]uddg=([^&]+)/);
	const target = match ? decodeURIComponent(match[1]) : href;
	if (!/^https?:\/\//i.test(target)) return null;
	try {
		const url = new URL(target);
		return url.toString();
	} catch {
		return null;
	}
};

const searchDuckDuckGo = async (query) => {
	const endpoints = [
		`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
		`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`
	];

	for (const endpoint of endpoints) {
		try {
			const res = await fetchWithTimeout(endpoint);
			if (!res.ok) continue;
			const html = await res.text();
			const results = [];
			const seen = new Set();
			const linkPattern = /<a[^>]+class="[^"]*result(?:__a|-link)[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
			let match;
			while ((match = linkPattern.exec(html)) !== null && results.length < EVIDENCE_MAX * 2) {
				const url = decodeDdgHref(match[1]);
				const title = stripHtml(match[2]);
				if (!url || !title) continue;
				const host = new URL(url).host;
				if (seen.has(host) && results.some((r) => r.title === title)) continue;
				seen.add(url);
				results.push({ url, title });
			}
			if (results.length > 0) return results.slice(0, EVIDENCE_MAX);
		} catch {
			// try the next endpoint
		}
	}

	return [];
};

const extractTitle = (html) => {
	const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
	return match ? stripHtml(match[1]) : '';
};

const readableExcerpt = (text) => {
	const start = text.search(/\b(wikipedia|abstract|introduction|summary)\b/i);
	const body = start > 200 ? text.slice(start) : text;
	return body.slice(0, 6000);
};

const fetchEvidence = async (url) => {
	const res = await fetchWithTimeout(url);
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const contentType = res.headers.get('content-type') ?? '';
	if (!contentType.includes('html') && !contentType.includes('text')) {
		throw new Error(`unsupported content-type ${contentType.split(';')[0]}`);
	}
	const html = await res.text();
	const text = stripHtml(html);
	if (text.length < 400) throw new Error('page too short to be useful evidence');
	return {
		title: extractTitle(html),
		content: readableExcerpt(text)
	};
};

const synthesizeReport = async ({ res, query, evidence, model }) => {
	const systemPrompt =
		'You are a rigorous research writer. Using ONLY the supplied evidence excerpts, produce a concise, well-structured markdown report that answers the research query. Structure: a one-paragraph summary, then short sections with ## headings, then a "## Sources" section listing the source URLs you actually used. If the evidence is insufficient, say so plainly rather than speculating.';

	const evidenceText = evidence
		.map(
			(item, idx) =>
				`[${idx + 1}] ${item.title || item.url}\nURL: ${item.url}\n${item.content}`
		)
		.join('\n\n');

	const body = {
		model,
		stream: true,
		// Thinking models spend their budget on reasoning tokens; the report
		// should be final prose, so disable thinking when the server supports it.
		think: false,
		options: { temperature: 0.4 },
		messages: [
			{ role: 'system', content: systemPrompt },
			{ role: 'user', content: `Research query: ${query}\n\nEvidence:\n\n${evidenceText}` }
		]
	};

	const ollamaRes = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});

	if (!ollamaRes.ok || !ollamaRes.body) {
		const detail = await ollamaRes.text().catch(() => '');
		throw new Error(`Ollama synthesis failed (${ollamaRes.status}): ${detail.slice(0, 200)}`);
	}

	let report = '';
	const reader = ollamaRes.body.getReader();
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
				const chunk = JSON.parse(line);
				const content = chunk?.message?.content ?? '';
				if (content) {
					report += content;
					emit(res, { type: 'report_chunk', content });
				}
			} catch {
				// ignore malformed stream lines
			}
		}
	}

	if (!report.trim()) throw new Error('Ollama returned an empty report');
	return report;
};

const runResearch = async (res, query, model) => {
	emit(res, { type: 'started', query });

	emit(res, { type: 'searching', query });
	const results = await searchDuckDuckGo(query);
	if (results.length === 0) {
		emit(res, {
			type: 'error',
			message: 'No sources found. Check outbound network access on the service host.'
		});
		return;
	}

	const evidence = [];
	for (const result of results) {
		if (evidence.length >= EVIDENCE_MAX) break;
		emit(res, { type: 'source_found', source: result });
		emit(res, { type: 'reading', source: result });
		try {
			const page = await fetchEvidence(result.url);
			const item = { ...result, title: page.title || result.title, content: page.content };
			evidence.push(item);
			emit(res, { type: 'note', source: { url: item.url, title: item.title }, content: item.content.slice(0, 400) });
		} catch (err) {
			emit(res, { type: 'note', source: result, content: `unreachable: ${err.message}` });
		}
	}

	if (evidence.length === 0) {
		emit(res, { type: 'error', message: 'All candidate sources were unreachable.' });
		return;
	}

	emit(res, {
		type: 'analyzing',
		message: `Analyzing ${evidence.length} source${evidence.length === 1 ? '' : 's'} for: ${query}`
	});

	emit(res, { type: 'writing' });
	const report = await synthesizeReport({ res, query, evidence, model });

	emit(res, { type: 'completed', report, sources: evidence.map((e) => ({ url: e.url, title: e.title })) });
};

const handleResearch = (req, res, origin) => {
	const headers = corsHeaders(origin);
	if (!headers) {
		res.writeHead(403, { 'Content-Type': 'application/json' });
		res.end(JSON.stringify({ error: 'origin not allowed' }));
		return;
	}

	res.writeHead(200, { ...headers, 'Content-Type': 'application/x-ndjson', 'X-Accel-Buffering': 'no', 'Cache-Control': 'no-cache' });

	let body = '';
	req.on('data', (chunk) => {
		body += chunk;
		if (body.length > 32_000) req.destroy();
	});
	req.on('end', () => {
		let query = '';
		let model = OLLAMA_MODEL;
		try {
			const parsed = JSON.parse(body || '{}');
			query = typeof parsed.query === 'string' ? parsed.query.trim() : '';
			model = typeof parsed.model === 'string' && parsed.model.trim() ? parsed.model.trim() : OLLAMA_MODEL;
		} catch {
			emit(res, { type: 'error', message: 'invalid JSON body' });
			res.end();
			return;
		}

		if (!query) {
			emit(res, { type: 'error', message: 'query is required' });
			res.end();
			return;
		}

		runResearch(res, query, model)
			.catch((err) => {
				emit(res, { type: 'error', message: err?.message ?? 'research failed' });
			})
			.finally(() => res.end());
	});
	req.on('error', () => res.end());
};

const server = http.createServer((req, res) => {
	const origin = req.headers.origin;

	if (req.method === 'OPTIONS') {
		const headers = corsHeaders(origin);
		if (!headers) {
			res.writeHead(403);
		} else {
			res.writeHead(204, headers);
		}
		res.end();
		return;
	}

	if (req.method === 'GET' && (req.url === '/health' || req.url === '/')) {
		const headers = corsHeaders(origin) ?? {};
		res.writeHead(200, { ...headers, 'Content-Type': 'application/json' });
		res.end(JSON.stringify({ ok: true, service: 'hugo-deep-research', ollama: OLLAMA_BASE_URL }));
		return;
	}

	if (req.method === 'POST' && req.url === '/research') {
		handleResearch(req, res, origin);
		return;
	}

	res.writeHead(404, { 'Content-Type': 'application/json' });
	res.end(JSON.stringify({ error: 'not found' }));
});

server.listen(PORT, () => {
	console.log(`hugo-deep-research listening on http://127.0.0.1:${PORT}`);
	console.log(`ollama: ${OLLAMA_BASE_URL} (model: ${OLLAMA_MODEL})`);
});
