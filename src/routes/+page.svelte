<script lang="ts">
	// import { tests } from '@douganderson444/ardag';
	import { onMount } from 'svelte';

	let result: string = '';
	let serverUrl: string;
	let tests;
	let error: string;
	onMount(async () => {
		({ tests } = await import('@douganderson444/ardag'));
	});

	async function handleRun(e: Event) {
		if (!tests) return;
		if (!serverUrl) {
			error = 'Please enter an Arweave server URL to use (localhost:1984 perhaps?)';
			return;
		}
		error = null;

		// create a simple logger that I can pass to tests that will append a string instead of writing to console.log
		const logger = {
			log: (str: string | object) => {
				console.log(str);
				// JSON.stringify if str is an object
				result += typeof str === 'string' ? `<br>${str}` : `<br>${JSON.stringify(str)}`;
			}
		};

		const r = await tests(serverUrl, logger);
		logger.log(r);
	}
</script>

Arweave Server URL: <input bind:value={serverUrl} placeholder="http://localhost:1984" />
{serverUrl ? serverUrl : 'No server URL entered'}

<button on:click={handleRun} disabled={!serverUrl}>Run Tests</button>

{#if error}
	<p style="color:red">{error}</p>
{/if}

{#if result}
	<pre>{@html result}</pre>
{/if}
