<script lang="ts">
	import { fade } from 'svelte/transition';
	import { WEBUI_BASE_URL } from '$lib/constants';

	const SECRET = 'hugo';

	let show = false;
	let typed = '';

	const isEditable = (target: EventTarget | null) => {
		const el = target as HTMLElement | null;
		if (!el || !el.tagName) return false;
		if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return true;
		return el.isContentEditable || !!el.closest?.('[contenteditable="true"], .ProseMirror');
	};

	const handleKeydown = (event: KeyboardEvent) => {
		if (show) {
			if (event.key === 'Escape') {
				event.preventDefault();
				show = false;
			}
			return;
		}

		if (event.ctrlKey || event.metaKey || event.altKey || isEditable(event.target)) {
			typed = '';
			return;
		}
		if (event.key.length !== 1) return;

		typed = (typed + event.key.toLowerCase()).slice(-SECRET.length);
		if (typed === SECRET) {
			typed = '';
			show = true;
		}
	};
</script>

<svelte:window on:keydown={handleKeydown} />

{#if show}
	<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
	<div
		class="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 px-4"
		transition:fade={{ duration: 150 }}
		on:click={() => (show = false)}
	>
		<div
			class="flex max-w-sm flex-col items-center gap-4 rounded-xl border border-gray-200 bg-white px-8 py-7 text-center dark:border-gray-800 dark:bg-gray-900"
			role="dialog"
			aria-label="HUGO"
		>
			<img
				src="{WEBUI_BASE_URL}/static/favicon.png"
				alt="HUGO"
				class="size-14 rounded-full"
				draggable="false"
			/>
			<div class="font-mono text-[0.8125rem] tracking-wide text-gray-800 dark:text-gray-100">
				This was created by Carmelo Schepis
			</div>
			<div
				class="font-mono text-[0.625rem] uppercase tracking-[0.15em] text-gray-400 dark:text-gray-600"
			>
				esc to close
			</div>
		</div>
	</div>
{/if}
