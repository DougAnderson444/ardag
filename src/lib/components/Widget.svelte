<script lang="ts">
	import { onMount, createEventDispatcher } from 'svelte';
	import Arweave from 'arweave';
	import * as ArDag from '../'; // this library
	import { createDagRepo } from '@douganderson444/ipld-car-txs'; // build ipld one tx at a time
	import type { DagRepo } from '@douganderson444/ipld-car-txs'; // build ipld one tx at a time
	import type { JWKInterface } from 'arweave/node/lib/wallet';

	export let wallet: JWKInterface | null = null; // users can pass in a JWK if they like
	export let arweave = Arweave.init({}); // users can pass in an Arweave instance if they like
	export let post: Function | null = null; // optional override function for posting tx t Arweave
	export let repoPath: string | null = null;
	export let dag: DagRepo = null;

	const dispatch = createEventDispatcher();

	let serverUrl: string = 'http://localhost:1984';
	// destructure serverUrl up into host, port, protocol
	let { host, port, protocol } = new URL(serverUrl);

	// remove colon and port from host
	host = host.replace(`:${port}`, '') || 'localhost';
	port = port || '443';
	protocol = protocol.replace(':', '');

	onMount(async () => {
		dag = dag || (await createDagRepo({ path: repoPath }));
		const ardag = ArDag.initializeArDag({ arweave, post });
		const myArDag = await ardag.getInstance({ wallet, dag }); // has contractId and wallet properties
		dispatch('ready', myArDag);
	});
</script>
