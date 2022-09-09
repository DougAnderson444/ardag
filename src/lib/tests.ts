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
	let post, wallet, rootCID;

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
		const p = doPost.bind(arweave.transactions);
		post = async (tx) => {
			const resp = await p(tx);
			await mine();
			console.log('Mined', tx.id);
			return resp;
		};
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

	async function aceTap(tag: string, obj: object) {
		// Add, commit, encode, Tag and Post
		// TX1
		rootCID = await dag.tx.add(tag, obj);
		const savedBuffer = await dag.tx.commit();
		const { cid: carCid } = await encode(savedBuffer);

		// create an Arweave data transaction
		let tx = await arweave.createTransaction({ data: savedBuffer });

		const tags = [
			{ name: 'Root-CID', value: [rootCID.toString()] },
			{ name: 'CAR-CID', value: [carCid.toString()] }
		];

		if (tags && tags.length) {
			for (const tag of tags) {
				tx.addTag(tag.name.toString(), tag.value.toString());
			}
		}
		// post it to Arweave
		await arweave.transactions.sign(tx, wallet.jwk);
		await post(tx);
		return tx.id;
	}

	let txId1 = await aceTap(key, v1);
	let txId2 = await aceTap(key, v2);

	/**
	 * Now that you have 2 transactions, save their TxIds to SmArTweave contract via ArDagTxs
	 */
	const ardag = createArDag({ arweave, post });

	// create a contract if you don't have one
	const contractId = await ardag.createNewArDag(wallet.jwk); // uses wallet if no jwk specified

	async function crisp(contractId: string, ardagtxid: string) {
		// Create, Sign, Post
		const tx = await ardag.createTx(contractId, { function: 'ArDagTx', ardagtxid });
		await arweave.transactions.sign(tx, wallet.jwk);
		console.log('Contract Updated with', ardagtxid);
		await post(tx);
	}

	await crisp(contractId, txId1);
	await crisp(contractId, txId2);

	// load buffer from Contract transactions
	const searchTags = [
		{ name: 'App-Name', values: ['SmartWeaveAction'] },
		{ name: 'Contract', values: [contractId] }
	];

	const txs = await ardb.search('transactions').tags(searchTags).findAll();

	// now read the buffers from Arweave and load them into a new dag, see if they match
	const rebuiltDag = await createDagRepo({ path: 'rebuiltDag' }); // make a barebones dag repo for fast loading

	for (const tx of txs) {
		const parsed = JSON.parse(tx.tags.find((el) => el.name === 'Input').value);
		const txid = parsed.ardagtxid;
		const data = await arweave.transactions.getData(txid);
		const buffer = new Uint8Array(decodeURLSafe(data));
		const r = await rebuiltDag.importBuffer(buffer); // as many as you need
		console.log(`Loaded from Arweave ${r.toString()}`);
	}

	const rebuiltCurrent = (await rebuiltDag.get(rootCID, { path: `/${key}/current/number` })).value;
	console.log(rebuiltCurrent, v2.number == rebuiltCurrent);
	const rebuiltPrev = (await rebuiltDag.get(rootCID, { path: `/${key}/prev/number` })).value;
	console.log(rebuiltPrev, v1.number == rebuiltPrev);

	return v1.number == rebuiltPrev && v2.number == rebuiltCurrent;
}
