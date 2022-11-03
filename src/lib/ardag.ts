import type { CreateTransactionInterface } from 'arweave/node/common';
import type { JWKInterface } from 'arweave/node/lib/wallet';
import type Transaction from 'arweave/node/lib/transaction';
import { importBuffer, encode, Transaction } from '@douganderson444/ipld-car-txs'; // build ipld one tx at a time
import type { DagRepo } from '@douganderson444/ipld-car-txs'; // build ipld one tx at a time
import { encodeURLSafe, decodeURLSafe } from '@stablelib/base64';
import type { IPFS } from 'ipfs-core-types';
import { getOwnerArDag } from './utils';

const AR_DAG = 'ArDag';

/**
 * Persist only needs an Arweave client to work.
 */
export async function persist({ buffer = null, arweave = null, wallet = null, tags = [] }) {
	if (!buffer) throw new Error('buffer is required');
	if (!arweave) {
		if (!this.arweave) throw new Error('Arweave is required');
		arweave = this.arweave;
	}
	if (!wallet) {
		if (this.wallet) wallet = this.wallet;
		// else, still ok if it's null b/c we will 'use_wallet' from window object in the browser
	}

	const { root: rootCID } = await Transaction.load(buffer);
	const { cid: carCid } = await encode(buffer);

	// create an Arweave data transaction
	let tx = await arweave.createTransaction({ data: buffer });

	tags.push({ name: 'App-Name', value: [AR_DAG] });
	tags.push({ name: 'Root-CID', value: [rootCID.toString()] });
	tags.push({ name: 'CAR-CID', value: [carCid.toString()] });

	if (tags && tags.length) {
		for (const tag of tags) {
			tx.addTag(tag.name.toString(), tag.value.toString());
		}
	}
	// post it to Arweave
	await arweave.transactions.sign(tx, wallet); // TODO: if dispatch is used, sign happens twice
	await this.post(tx);
	return rootCID;
}

// load a DagAPI with existing data from dagOwner
export async function load({
	dagOwner,
	dag,
	arweave = null
}: {
	dagOwner: string; // has to be the Arweave address
	dag: DagRepo | DagAPI;
	arweave?: Arweave;
}) {
	if (!dagOwner) throw new Error('dagOwner is required');
	if (!dag) {
		if (!this.dag) throw new Error('DagRepo is required');
		dag = this.dag;
	}
	if (!arweave) {
		if (!this.arweave) throw new Error('Arweave is required');
		arweave = this.arweave;
	}
	// load buffer from Contract transactions
	const searchTags = [{ name: 'App-Name', values: [AR_DAG] }];

	let txs = null;
	try {
		txs = await getOwnerArDag({ arweave, searchTags, dagOwner });
	} catch (error) {
		console.log('ArDag get failed', error);
	}

	let rootCID;

	const importer = async (dag: IPFS['dag'], tx) => {
		// const parsed = JSON.parse(tx.tags.find((el) => el.name === 'Input').value);
		// const txid = parsed.ardagtxid;
		try {
			const data: Uint8Array = await getData({ arweave, txid: tx.id });
			const cid = await importBuffer(dag, data); // as many as you need
			if (!rootCID) rootCID = cid; // return latest rootCID
			if (dag.hasOwnProperty('rootCID') && !dag?.rootCID) dag.rootCID = cid; // make the most recent rootCID this rootCID
		} catch (error) {
			console.log('Import failed', error);
		}
	};

	for (const tx of txs) {
		await importer(dag, tx);
	}

	return rootCID;
}

export async function get({ dagOwner, tag = null, arweave = null, cid = null }) {
	if (!dagOwner) throw new Error('dagOwner is required');
	if (!arweave) {
		if (!this.arweave) {
			const Arweave = require('arweave').default;
			arweave = Arweave.init({
				host: 'arweave.net',
				port: 443,
				protocol: 'https',
				timeout: 20000,
				logging: false
			});
		} else {
			arweave = this.arweave;
		}
	}
	const searchTags = [{ name: 'App-Name', values: [AR_DAG] }];

	let txs = null;
	try {
		txs = await getOwnerArDag({ arweave, searchTags, dagOwner });
	} catch (error) {
		console.log('ArDag get failed', error);
	}

	if (!txs) return null;

	let latest;
	let latestCID = cid;

	while (!latest && txs.length) {
		let data: Uint8Array | undefined;
		let txid = txs.shift().id;
		try {
			data = await getData({ arweave, txid });
		} catch (error) {
			console.log('get Data txid failed', { txid }, error);
			if (!data) continue;
		}

		const { root, get } = await Transaction.load(data);
		const rootNode = await get(root);

		if (!tag && !cid) return rootNode; // no search criteria besides the owner, return root

		if (tag && rootNode.hasOwnProperty(tag) && !latestCID) latestCID = rootNode[tag].obj;

		try {
			latest = await get(latestCID);
		} catch (error) {
			// not here, keep looking
		}
	}

	return latest;
}

/**
 * Convenience function for (await arDagInst.dag.get(rootCID, { path: `/${tag}/obj` })).value;
 * Needs to assure load has been done, and needs to work with multiDags.
 *
 * TODO: Change to:
 * rootCID = load(dagOwner)
 * dag.get(rootCID, {path: `/${tag}/obj`})
 */
export async function latest(tag: string) {
	const res = await this.dag.get(this.rootCID, { path: `/${tag}/obj` });
	return res.value;
}
export async function getInstance({
	dag,
	wallet = null,
	dagOwner = false // load existing contract, or create a new one
}: {
	dag: DagRepo;
	wallet?: JWKInterface | 'use_wallet';
	dagOwner?: string;
}): Promise<{ save: Function }> {
	if (!dag)
		throw new Error('Supply a DagRepo from https://github.com/DougAnderson444/ipld-car-txs');
	if (!dagOwner) {
		// dagOwner is sha256 hash of wallet public key
		dagOwner = await this.arweave.wallets.jwkToAddress(wallet);
	} else {
		this.rootCID = await this.load({ dag, dagOwner });
	}

	return {
		arweave: this.arweave, // inherit this from parent object
		post: this.post, // inherit this from parent object
		dagOwner,
		wallet,
		dag,
		load, // myArDag.load(dagOwner) may need to be called if the Arweave is written from elsewhere after getInstance was originally called
		rootCID: this.rootCID || null,
		latest,
		persist,
		async save(tag: string, obj: object, { tags } = { tags: [] }) {
			const rootCID = await this.dag.tx.add(tag, obj);
			this.rootCID = rootCID;
			const buffer = await this.dag.tx.commit();
			const r = await this.persist({ buffer, tags });
			return rootCID;
		}
	};
}

// creates a new ArDag object
export function initializeArDag({ arweave, post = null }: { arweave: Arweave; post?: any }): ArDag {
	if (!arweave) throw new Error('Arweave instance must be provided');
	// need to bind transactions.post to arweave.transactions as *this*
	const doPost = arweave.transactions.post;
	const boundPost = doPost.bind(arweave.transactions);

	return {
		arweave,
		post: post || boundPost,
		getData,
		getInstance,
		persist,
		get,
		load // this.load is required in getInstance
	};
}

export async function getData({ arweave = null, txid }): Promise<Uint8Array> {
	if (!txid) throw new Error('txid is required');
	if (!arweave) {
		if (!this.arweave) throw new Error('Arweave is required');
		arweave = this.arweave;
	}
	try {
		let result = await arweave.api.get(`/${txid}`, { responseType: 'arraybuffer' });
		if (result.status >= 200 && result.status < 300) {
			return new Uint8Array(result.data);
		}
	} catch (error) {
		console.log('get Data failed', { txid }, error);
	}
}
