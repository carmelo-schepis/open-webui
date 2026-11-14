import { writable } from 'svelte/store';

/** Verbatim from Hugo's humanizer client. */
export const HUMANIZER_PROMPT = `Rewrite the user's text so it reads like a person wrote it without changing what it says.

Keep every fact, name, number, date, quote, URL, citation, and qualification. Don't invent details. Match the source's formal, casual, personal, or technical tone. Keep genuine personality, mixed feelings, useful uncertainty, and deliberate quirks.

Remove AI writing patterns when they occur: inflated importance, name-dropping, shallow analysis added with ing phrases, sales language, vague sources, formulaic challenge and outlook sections, stock AI vocabulary, avoidance of simple is and are verbs, not-X-but-Y contrasts, forced groups of three, synonym cycling, repeated sentence openings, false ranges, passive voice that hides the actor, excess dashes, excess emphasis, lists with mini-headings, title case headings, decorative emoji, chatbot greetings and closings, knowledge-limit disclaimers, guesses presented as facts, excessive agreement, filler, stacked qualifiers, generic positive endings, fake deeper truths, announcements of the next point, repeated headings, forced punchlines, fake-candid openings, objections nobody raised, and fake alternatives.

Use direct sentences, concrete wording, simple verbs, natural sentence-length variation, and only as much structure as the meaning needs. Never output an asterisk character.

Return only the final rewritten text. Don't describe your edits, add a heading, or wrap the result in quotation marks or code fences.`;

/** Whether the next sent message is rewritten by the Humanizer instead of answered. */
export const humanizerEnabled = writable(false);

/** Set by the response-message action menu; Chat.svelte picks it up and appends a humanized block. */
export const humanizeRequest = writable<{ messageId: string } | null>(null);

export type HumanizerMessage = { role: 'system' | 'user'; content: string };

export const buildHumanizerMessages = (text: string): HumanizerMessage[] => [
	{ role: 'system', content: HUMANIZER_PROMPT },
	{ role: 'user', content: text }
];
