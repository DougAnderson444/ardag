<script>
	import { onMount } from 'svelte';

	export let address = '';

	onMount(async () => {
		const { initializeArDag, load } = await import('@douganderson444/ardag');
	});
</script>

<div class="">
	<div class="">
		<input type="text" bind:value={address} placeholder="Enter Arweave address" />
		<button
			class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
			on:click={() => {
				console.log(address);
			}}>Go</button
		>
	</div>
</div>
{#if address}{/if}
