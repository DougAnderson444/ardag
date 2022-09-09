<script lang="ts">
	// import { tests } from '@douganderson444/ardag';
	import { onMount } from 'svelte';

	let result: undefined | string;

	onMount(async () => {
		const { tests } = await import('@douganderson444/ardag');

		result = await tests();
		console.log(result);
	});
</script>

{#if result}
	<pre>{JSON.stringify(result, null, 2)}</pre>
{/if}
