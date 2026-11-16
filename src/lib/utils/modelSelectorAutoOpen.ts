// The model selector opens by itself at most once per page load, and only on a
// brand-new chat. Landing on an existing chat, starting a conversation, or
// having already auto-opened all retire the one-shot for the rest of the
// session. The input remounts while the model list settles, so a pending
// one-shot survives remounts and retries (capped) until a stable instance
// keeps the selector open.
let done = false;
let attempts = 0;
const MAX_ATTEMPTS = 5;

export const isAutoOpenPending = (): boolean => !done && attempts < MAX_ATTEMPTS;

export const retireAutoOpen = (): void => {
	done = true;
};

/** Count a remounted attempt; the caller re-invokes open() until it sticks. */
export const noteAutoOpenAttempt = (): boolean => {
	attempts += 1;
	return attempts < MAX_ATTEMPTS;
};
