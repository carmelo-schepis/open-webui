<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { writable } from 'svelte/store';
	import { goto } from '$app/navigation';

	import { user } from '$lib/stores';
	import {
		getServerLabel,
		loadOllamaServers,
		ollamaServers,
		serverAliases
	} from '$lib/utils/serverAliases';
	import { OLLAMA_API_BASE_URL } from '$lib/constants';

	const UPTIME_KEY = 'hugo.uptime';
	const POLL_INTERVAL = 60_000;
	const PROBE_TIMEOUT = 5_000;

	type UptimeEntry = {
		status: 'up' | 'down' | 'unknown';
		latency: number | null;
		lastCheck: number;
	};

	const readEntries = (): Record<string, UptimeEntry> => {
		try {
			const parsed = JSON.parse(localStorage.getItem(UPTIME_KEY) ?? '{}');
			if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
				return parsed as Record<string, UptimeEntry>;
			}
		} catch {
			// corrupt or unavailable storage — start fresh
		}
		return {};
	};

	const entries = writable<Record<string, UptimeEntry>>(readEntries());

	const persistEntry = (url: string, entry: UptimeEntry) => {
		const next = { ...readEntries(), [url]: entry };
		entries.set(next);
		try {
			localStorage.setItem(UPTIME_KEY, JSON.stringify(next));
		} catch {
			// ignore quota / privacy-mode failures
		}
	};

	const probe = async (token: string, idx: number, url: string) => {
		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT);
		const started = performance.now();
		try {
			const res = await fetch(`${OLLAMA_API_BASE_URL}/api/version/${idx}`, {
				signal: controller.signal,
				headers: { Accept: 'application/json', Authorization: `Bearer ${token}` }
			});
			const latency = Math.round(performance.now() - started);
			persistEntry(url, {
				status: res.ok ? 'up' : 'down',
				latency: res.ok ? latency : null,
				lastCheck: Date.now()
			});
		} catch {
			persistEntry(url, { status: 'down', latency: null, lastCheck: Date.now() });
		} finally {
			clearTimeout(timer);
		}
	};

	const probeAll = async (force = false) => {
		if (!force && document.hidden) return;

		const token = localStorage.token;
		const servers = $ollamaServers;
		if (servers.length === 0) return;

		for (const server of servers) {
			probe(token, server.idx, server.url);
		}
	};

	const onVisibilityChange = () => {
		if (!document.hidden) probeAll(true);
	};

	let pollTimer: ReturnType<typeof setInterval> | null = null;

	onMount(async () => {
		if ($user?.role !== 'admin') return;

		await loadOllamaServers(localStorage.token, true);
		await probeAll(true);

		pollTimer = setInterval(probeAll, POLL_INTERVAL);
		document.addEventListener('visibilitychange', onVisibilityChange);
	});

	onDestroy(() => {
		if (pollTimer) clearInterval(pollTimer);
		document.removeEventListener('visibilitychange', onVisibilityChange);
	});

	const formatLastCheck = (lastCheck: number | undefined) => {
		if (!lastCheck) return 'never';
		const seconds = Math.round((Date.now() - lastCheck) / 1000);
		if (seconds < 5) return 'just now';
		if (seconds < 60) return `${seconds}s ago`;
		const minutes = Math.round(seconds / 60);
		if (minutes < 60) return `${minutes}m ago`;
		return `${Math.round(minutes / 60)}h ago`;
	};

	const openServerSettings = () => {
		goto('/admin/settings/connections');
	};
</script>

{#if $ollamaServers.length > 0}
	<div class="px-1.5 space-y-0.5">
		{#each $ollamaServers as server (server.url)}
			{@const entry = $entries[server.url]}
			{@const label = getServerLabel(server, $serverAliases)}
			<button
				type="button"
				class="w-full flex items-center space-x-2 rounded-xl px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-900 transition outline-none"
				on:click={openServerSettings}
				aria-label={label}
				title={server.url}
			>
				<div class="self-center flex size-4 shrink-0 items-center justify-center">
					<span
						class="relative inline-flex size-2 rounded-full {entry?.status === 'up'
							? 'bg-green-500'
							: entry?.status === 'down'
								? 'bg-red-500'
								: 'bg-gray-300 dark:bg-gray-700'}"
					>
						{#if entry?.status === 'up'}
							<span
								class="animate-ping absolute inline-flex size-2 rounded-full bg-green-400 opacity-75"
							></span>
						{/if}
					</span>
				</div>

				<div class="flex flex-1 self-center min-w-0">
					<div class="self-center text-[0.8125rem] leading-5 truncate">{label}</div>
				</div>

				<div class="self-center text-[0.6875rem] leading-5 text-gray-500 dark:text-gray-500 tabular-nums">
					{entry?.status === 'up' && entry?.latency != null ? `${entry.latency}ms` : '—'}
					<span class="mx-1">·</span>
					{formatLastCheck(entry?.lastCheck)}
				</div>
			</button>
		{/each}
	</div>
{:else if $ollamaServers.length === 0 && $user?.role === 'admin'}
	<div class="px-3 py-1 text-[0.75rem] leading-5 text-gray-500 dark:text-gray-500">
		No Ollama servers configured.
	</div>
{/if}
