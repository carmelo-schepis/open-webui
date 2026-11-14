/**
 * The "system activity" sequence shown while HUGO Harness is waiting for the
 * first real token to arrive from the model.
 *
 * These are presentation-only status lines — they describe connection,
 * context loading, and stream preparation steps the app genuinely performs.
 * They NEVER claim to expose the model's reasoning.
 */

export type ActivityStep = {
	text: string;
	durationMs: number;
};

// Opening lines: connection setup (kept first, thematically ordered).
const OPENING = [
	'Connecting to mainframe…',
	'Contacting local model…',
	'Resolving model endpoint…'
];

// Middle lines: context/session preparation (shuffled per sequence).
const MIDDLE = [
	'Warming inference engine…',
	'Loading conversation context…',
	'Synchronising session…',
	'Checking model availability…',
	'Fetching conversation state…',
	'Packing context window…',
	'Preparing prompt context…',
	'Synchronising local state…',
	'Verifying Ollama connection…',
	'Indexing recent messages…',
	'Negotiating model session…',
	'Checking local model health…',
	'Initialising response stream…',
	'Priming token stream…',
	'Finalising context window…',
	'Calibrating response format…',
	'Crafted by Carmelo Schepis…'
];

// Final lines: response preparation (kept ordered, ends the sequence).
const FINAL = [
	'Preparing generation request…',
	'Opening token stream…',
	'Finalising request…',
	'Preparing response stream…',
	'Waiting for first token…'
];

/** Number of middle lines to include per sequence. */
const MIDDLE_LINES = 8;

const hashText = (text: string): number => {
	let hash = 0;
	for (let i = 0; i < text.length; i++) {
		hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
	}
	return hash;
};

const shuffled = <T>(items: readonly T[]): T[] => {
	const copy = [...items];
	for (let i = copy.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[copy[i], copy[j]] = [copy[j]!, copy[i]!];
	}
	return copy;
};

/**
 * Builds a randomized activity sequence. Durations vary per step
 * (700–1400ms) and are derived deterministically from each line so the
 * rhythm feels slightly different on every conversation without a global
 * timer. The opening lines stay first and the response-preparation lines
 * stay last.
 */
export function buildActivitySequence(): ActivityStep[] {
	const middle = shuffled(MIDDLE).slice(0, MIDDLE_LINES);
	const texts = [...OPENING, ...middle, ...FINAL];
	return texts.map((text) => ({
		text,
		durationMs: 700 + (hashText(text) % 700)
	}));
}
