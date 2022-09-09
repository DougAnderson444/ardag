import { create as createArDag } from '@douganderson444/ardag'; // this library
import { createDagRepo, encode } from '@douganderson444/ipld-car-txs'; // build ipld one tx at a time
import Arweave from 'arweave';
import ArDB from 'ardb'; // access Arweave like a Database
import { encodeURLSafe, decodeURLSafe } from '@stablelib/base64';

// Bundlr access using dispatch
// import { handlers as wallet, generateRsaJwk } from '@peerpiper/iframe-wallet-sdk';

let arweave: Arweave;
let dev = true; // useTestnet

export async function generateWallet(arweave) {
	let wallet: {
		address: string;
		jwk: JWKInterface;
	} = { address: '', jwk: undefined };

	wallet.jwk = await arweave.wallets.generate();
	wallet.address = await arweave.wallets.getAddress(wallet.jwk);

	return wallet;
}

async function triggerFaucet(arweave, wallet) {
	await arweave.api.get(`/mint/${wallet.address}/1000000000000`);
}

async function mine() {
	await arweave.api.get('mine');
}

export async function tests(): boolean {
	let post, wallet;

	if (dev) {
		// Save this buffer as an Arweave Contract Transaction
		arweave = Arweave.init({
			host: 'localhost',
			port: 1984,
			protocol: 'http',
			timeout: 20000,
			logging: false
		});
		// use testNet for testing
		wallet = await generateWallet(arweave);
		await triggerFaucet(arweave, wallet);
		await mine();

		// need to bind transactions.post to arweave.transactions as *this*
		const doPost = arweave.transactions.post;
		post = doPost.bind(arweave.transactions);
	} else {
		arweave = Arweave.init({});
		// use Bunldr for production
		await generateRsaJwk();
		post = wallet.arweaveWalletAPI.dispatch; // need to have browser open to approve confirmation if > 100kb
	}

	const ardb = new ArDB(arweave);

	// create 2 dag transactions
	let dag = await createDagRepo(); // make a barebones dag repo for fast loading

	let key = 'Mobile';
	let v1 = { number: '555-1234' };
	let v2 = { number: '+1-555-555-1234' };

	// TX1
	let rootCID = await dag.tx.add(key, v1);
	const savedBuffer = await dag.tx.commit();
	const { cid: carCid } = await encode(savedBuffer);

	// TX2
	let rootCID2 = await dag.tx.add(key, v2);
	const savedBuffer2 = await dag.tx.commit();
	const { cid: carCid2 } = await encode(savedBuffer2);

	/**
	 * Now that you have 2 transactions, save them to Arweave via ArDagTxs
	 */
	const ardag = createArDag({ arweave, post });

	// create a contract if you don't have one
	const contractId = await ardag.createNewArDag(wallet.jwk); // uses wallet if no jwk specified

	const tags = [
		{ name: 'Root-CID', value: [rootCID.toString()] },
		{ name: 'CAR-CID', value: [carCid.toString()] }
	];
	let input = {
		function: 'ArDagTx',
		ardagtx: encodeURLSafe(savedBuffer)
	};

	// write the 1st data buffer to this log
	const transaction1 = await ardag.createTx(contractId, input, tags);
	await arweave.transactions.post(transaction1);

	const secondTags = [
		{ name: 'Root-CID', value: [rootCID2.toString()] },
		{ name: 'CAR-CID', value: [carCid2.toString()] }
	];
	const input2 = {
		function: 'ArDagTx',
		ardagtx: encodeURLSafe(savedBuffer2)
	};

	// write the 2nd data buffer to this log
	const transaction2 = await ardag.createTx(contractId, input2, secondTags);
	await arweave.transactions.post(transaction2);
	// const txid2 = await ardag.post(transaction2);

	// load buffer from Contract transactions
	const searchTags = [
		{
			name: 'App-Name',
			values: ['SmartWeaveAction'] // SmartWeaveContract
		},
		{
			name: 'Contract',
			values: [contractId]
		}
	];

	const txs = await ardb.search('transactions').tags(searchTags).findAll();

	// now read the buffers from Arweave and load them into a new dag, see if they match
	const rebuiltDag = await createDagRepo({ path: 'rebuiltDag' }); // make a barebones dag repo for fast loading

	txs.forEach(async (tx) => {
		console.log('tx', tx);
		const parsed = JSON.parse(tx.tags.find((el) => el.name === 'Input').value);
		const buffer = new Uint8Array(decodeURLSafe(parsed.ardagtx));
		await rebuiltDag.importBuffer(buffer); // as many as you need
	});

	const rebuiltCurrent = (await rebuiltDag.get(rootCID2, { path: `/${key}/current/number` })).value;
	console.log(rebuiltCurrent, v2.number == rebuiltCurrent);
	const rebuiltPrev = (await rebuiltDag.get(rootCID2, { path: `/${key}/prev/number` })).value;
	console.log(rebuiltPrev, v1.number == rebuiltPrev);

	return v1.number == rebuiltPrev && v2.number == rebuiltCurrent;
}
