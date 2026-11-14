// The model selector opens by itself at most once per page load, and only on a
// brand-new chat. Landing on an existing chat, starting a conversation, or having
// already auto-opened all retire the one-shot for the rest of the session.
let done = false;

export const isAutoOpenPending = (): boolean => !done;

export const retireAutoOpen = (): void => {
	done = true;
};
