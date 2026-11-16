<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { buildActivitySequence } from '$lib/utils/activityStatuses';

	/** How many lines stay on screen (the current line plus the most recent ones before it). */
	const VISIBLE_LINES = 6;

	const steps = buildActivitySequence();
	let current = 0;
	let timer: ReturnType<typeof setTimeout> | undefined;

	const advance = () => {
		if (current >= steps.length - 1) return; // hold on the final line until the first token arrives
		timer = setTimeout(() => {
			current += 1;
			advance();
		}, steps[current].durationMs);
	};

	onMount(advance);
	onDestroy(() => {
		if (timer) clearTimeout(timer);
	});

	$: first = Math.max(0, current - VISIBLE_LINES + 1);
	$: visible = steps.slice(first, current + 1).map((step, offset) => ({
		...step,
		index: first + offset
	}));
</script>

<div
	class="my-1 flex flex-col gap-0.5 border-l border-gray-200 py-0.5 pl-3 font-mono text-[0.75rem] leading-5 dark:border-gray-800"
	role="status"
	aria-label={steps[current].text}
	data-activity-sequence
>
	{#each visible as line (line.index)}
		<div
			class="flex items-center gap-2 transition-colors duration-300 {line.index === current
				? 'text-gray-800 dark:text-gray-100'
				: 'text-gray-400 dark:text-gray-600'}"
			in:fade={{ duration: 150 }}
			aria-hidden="true"
		>
			<span class="flex size-1.5 shrink-0 items-center justify-center">
				{#if line.index === current}
					<span class="size-1 rounded-full bg-current"></span>
				{/if}
			</span>
			<span class="truncate">{line.text}</span>
		</div>
	{/each}
</div>
