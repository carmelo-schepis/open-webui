<script lang="ts">
	import { onDestroy } from 'svelte';
	import { getContext } from 'svelte';
	import type i18nType from '$lib/i18n';
	import { toast } from 'svelte-sonner';
	import {
		getResearchServiceUrl,
		setResearchServiceUrl,
		streamResearch,
		type ResearchEvent,
		type ResearchSource
	} from '$lib/utils/deepResearchClient';

	const i18n: typeof i18nType = getContext('i18n');

	let query = '';
	let running = false;
	let serviceUrl = getResearchServiceUrl();
	let serviceOnline: boolean | null = null;

	type Phase = 'idle' | 'searching' | 'reading' | 'analyzing' | 'writing' | 'completed' | 'error';
	let phase: Phase = 'idle';
	let statusMessage = '';
	let sources: ResearchSource[] = [];
	let notes: { source: ResearchSource; content: string }[] = [];
	let report = '';
	let controller: AbortController | null = null;

	const reset = () => {
		phase = 'idle';
		statusMessage = '';
		sources = [];
		notes = [];
		report = '';
	};

	const checkService = async () => {
		serviceOnline = null;
		try {
			const res = await fetch(`${serviceUrl}/health`);
			serviceOnline = res.ok;
		} catch {
			serviceOnline = false;
		}
	};

	const handleEvent = (event: ResearchEvent) => {
		switch (event.type) {
			case 'started':
				phase = 'searching';
				statusMessage = `Researching: ${event.query}`;
				break;
			case 'searching':
				phase = 'searching';
				statusMessage = 'Searching the web…';
				break;
			case 'source_found':
				sources = [...sources, event.source];
				break;
			case 'reading':
				phase = 'reading';
				statusMessage = `Reading ${event.source.title || event.source.url}`;
				break;
			case 'note':
				notes = [...notes, { source: event.source, content: event.content }];
				break;
			case 'analyzing':
				phase = 'analyzing';
				statusMessage = event.message;
				break;
			case 'writing':
				phase = 'writing';
				statusMessage = 'Writing the report…';
				break;
			case 'report_chunk':
				report += event.content;
				break;
			case 'completed':
				phase = 'completed';
				statusMessage = `Done — ${event.sources.length} source${event.sources.length === 1 ? '' : 's'} used`;
				if (event.report) report = event.report;
				break;
			case 'error':
				phase = 'error';
				statusMessage = event.message;
				break;
		}
	};

	const run = async () => {
		if (!query.trim() || running) return;

		reset();
		running = true;
		controller = new AbortController();
		try {
			await streamResearch(query.trim(), { signal: controller.signal, onEvent: handleEvent });
			if (phase !== 'error') {
				phase = 'completed';
				if (!statusMessage) statusMessage = 'Done';
			}
		} catch (err) {
			if (controller.signal.aborted) {
				phase = 'idle';
				statusMessage = 'Research cancelled';
			} else {
				phase = 'error';
				statusMessage = `${err instanceof Error ? err.message : String(err)} — start the companion service with: node harness-services/deep-research/server.js`;
				toast.error($i18n.t('Research service unreachable'));
			}
		} finally {
			running = false;
			controller = null;
		}
	};

	const cancel = () => {
		controller?.abort();
	};

	const saveServiceUrl = () => {
		setResearchServiceUrl(serviceUrl);
		serviceUrl = getResearchServiceUrl();
		checkService();
	};

	const phaseLabel: Record<Phase, string> = {
		idle: '',
		searching: 'Searching',
		reading: 'Reading',
		analyzing: 'Analyzing',
		writing: 'Writing',
		completed: 'Completed',
		error: 'Error'
	};

	const hostOf = (url: string): string => {
		try {
			return new URL(url).host;
		} catch {
			return url;
		}
	};

	onDestroy(() => controller?.abort());
</script>

<div class="h-full overflow-y-auto px-4 py-6">
	<div class="mx-auto w-full max-w-3xl space-y-4">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-2">
				<h1 class="text-lg font-medium">{$i18n.t('Deep Research')}</h1>
				<span
					class="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.6875rem] uppercase tracking-wider {$serviceOnline === true
						? 'bg-green-500/10 text-green-500'
						: $serviceOnline === false
							? 'bg-red-500/10 text-red-500'
							: 'bg-gray-500/10 text-gray-500'}"
				>
					<span
						class="size-1.5 rounded-full {$serviceOnline === true
							? 'bg-green-500'
							: $serviceOnline === false
								? 'bg-red-500'
								: 'bg-gray-400'}"
					></span>
					{$serviceOnline === true
						? $i18n.t('Service online')
						: $serviceOnline === false
							? $i18n.t('Service offline')
							: $i18n.t('Checking service')}
				</span>
			</div>

			<div class="flex items-center gap-2">
				<input
					class="w-56 rounded-lg border border-gray-200 dark:border-gray-800 bg-transparent px-2 py-1 text-xs outline-hidden"
					bind:value={serviceUrl}
					on:change={saveServiceUrl}
					aria-label={$i18n.t('Research service URL')}
				/>
				<button
					type="button"
					class="rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-900 transition"
					on:click={checkService}
				>
					{$i18n.t('Recheck')}
				</button>
			</div>
		</div>

		<div class="flex gap-2">
			<input
				class="flex-1 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent px-3 py-2 text-sm outline-hidden"
				bind:value={query}
				on:keydown={(e) => {
					if (e.key === 'Enter' && !e.isComposing) run();
				}}
				placeholder={$i18n.t('What should this research session answer?')}
				disabled={running}
			/>

			{#if running}
				<button
					type="button"
					class="rounded-xl px-4 py-2 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-900 transition"
					on:click={cancel}
				>
					{$i18n.t('Stop')}
				</button>
			{:else}
				<button
					type="button"
					class="rounded-xl bg-black/[0.035] dark:bg-white/[0.06] px-4 py-2 text-sm font-medium transition hover:bg-black/[0.06] dark:hover:bg-white/[0.1] disabled:opacity-50"
					disabled={!query.trim()}
					on:click={run}
				>
					{$i18n.t('Research')}
				</button>
			{/if}
		</div>

		{#if phase !== 'idle' && statusMessage}
			<div class="flex items-center gap-2 text-sm text-gray-500">
				<span
					class="text-[0.6875rem] font-mono uppercase tracking-wider {phase === 'error'
						? 'text-red-500'
						: phase === 'completed'
							? 'text-green-500'
							: ''}"
				>
					{phaseLabel[phase]}
				</span>
				{#if running}
					<span class="size-1.5 rounded-full bg-gray-400 animate-pulse"></span>
				{/if}
				<span class="truncate">{statusMessage}</span>
			</div>
		{/if}

		{#if sources.length > 0}
			<div class="space-y-1">
				<div class="text-[0.6875rem] font-mono uppercase tracking-wider text-gray-500">
					{$i18n.t('Sources')} ({sources.length})
				</div>
				<div class="rounded-xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800/60">
					{#each sources as source, idx (source.url)}
						<a
							class="flex items-baseline gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-900 transition"
							href={source.url}
							target="_blank"
							rel="noreferrer"
						>
							<span class="text-[0.6875rem] font-mono text-gray-500">[{idx + 1}]</span>
							<span class="truncate font-medium">{source.title || source.url}</span>
							<span class="ml-auto shrink-0 truncate text-xs text-gray-500">{hostOf(source.url)}</span>
						</a>
					{/each}
				</div>
			</div>
		{/if}

		{#if notes.length > 0}
			<details class="rounded-xl border border-gray-200 dark:border-gray-800">
				<summary class="cursor-pointer select-none px-3 py-2 text-[0.6875rem] font-mono uppercase tracking-wider text-gray-500">
					{$i18n.t('Notes')} ({notes.length})
				</summary>
				<div class="space-y-2 px-3 pb-3">
					{#each notes as note, idx (idx)}
						<div class="text-xs text-gray-500">
							<div class="font-medium text-gray-600 dark:text-gray-400">
								{note.source.title || note.source.url}
							</div>
							<div class="whitespace-pre-wrap">{note.content}</div>
						</div>
					{/each}
				</div>
			</details>
		{/if}

		{#if report}
			<div class="rounded-xl border border-gray-200 dark:border-gray-800 px-4 py-3">
				<div class="mb-2 text-[0.6875rem] font-mono uppercase tracking-wider text-gray-500">
					{$i18n.t('Report')}
				</div>
				<div class="whitespace-pre-wrap text-sm leading-6">{report}</div>
			</div>
		{/if}

		{#if phase === 'idle' && !running && !report}
			<div class="text-sm text-gray-500">
				{$i18n.t('Runs the companion deep-research service: searches the web, reads sources, and writes a cited report with the selected Ollama model.')}
			</div>
		{/if}
	</div>
</div>
