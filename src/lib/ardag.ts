import type { CreateTransactionInterface } from 'arweave/node/common';
import type { JWKInterface } from 'arweave/node/lib/wallet';
import type Transaction from 'arweave/node/lib/transaction';
import { importBuffer, encode, Transaction } from '@douganderson444/ipld-car-txs'; // build ipld one tx at a time
import type { DagRepo } from '@douganderson444/ipld-car-txs'; // build ipld one tx at a time
import ArDB from 'ardb'; // access Arweave like a Database
import type { ArdbTransaction } from 'ardb/lib/models/transaction';
import { encodeURLSafe, decodeURLSafe } from '@stablelib/base64';
import type { IPFS } from 'ipfs-core-types';

import defaultContractSrc from './contract/contractSrc.js?raw';
import state from './contract/initial-state.json';

const AR_DAG = 'ArDag';

/**
 * Persist only needs an Arweave client to work.
 */
export async function persist({ buffer = null, arweave = null, wallet = null }) {
	if (!buffer) throw new Error('buffer is required');
	if (!arweave) {
		if (!this.arweave) throw new Error('Arweave is required');
		arweave = this.arweave;
	}
	if (!wallet) {
		if (this.wallet) wallet = this.wallet;
	}
	// else // will look for window.wallet

	const { root: rootCID } = await Transaction.load(buffer);
	const { cid: carCid } = await encode(buffer);

	// create an Arweave data transaction
	let tx = await arweave.createTransaction({ data: buffer });

	const tags = [
		{ name: 'App-Name', value: [AR_DAG] },
		{ name: 'Root-CID', value: [rootCID.toString()] },
		{ name: 'CAR-CID', value: [carCid.toString()] }
	];

	if (tags && tags.length) {
		for (const tag of tags) {
			tx.addTag(tag.name.toString(), tag.value.toString());
		}
	}
	// post it to Arweave
	await arweave.transactions.sign(tx, wallet);
	await this.post(tx);
	return rootCID;
}

// load a DagAPI with existing data from dagOwner
export async function load({
	dagOwner,
	dag,
	arweave = null
}: {
	dagOwner: string;
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

	const ardb = new ArDB(arweave);
	const txs = await ardb.search('transactions').tags(searchTags).from(dagOwner).findAll();

	let rootCID;

	const importer = async (dag: IPFS['dag'], tx: ArdbTransaction) => {
		// const parsed = JSON.parse(tx.tags.find((el) => el.name === 'Input').value);
		// const txid = parsed.ardagtxid;
		try {
			const data = await arweave.transactions.getData(tx.id);
			const buffer = new Uint8Array(decodeURLSafe(data));
			const cid = await importBuffer(dag, buffer); // as many as you need
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

export async function get({ dagOwner, tag = null, arweave = null }) {
	if (!dagOwner) throw new Error('dagOwner is required');
	if (!arweave) {
		if (!this.arweave) throw new Error('Arweave is required');
		arweave = this.arweave;
	}
	const searchTags = [{ name: 'App-Name', values: [AR_DAG] }];
	const ardb = new ArDB(arweave);
	const txs = await ardb.search('transactions').tags(searchTags).from(dagOwner).findAll();

	let latest;
	let latestCID;

	while (!latest && txs.length) {
		const data = await arweave.transactions.getData(txs.shift().id);
		const buffer = new Uint8Array(decodeURLSafe(data));
		const { root, get } = await Transaction.load(buffer);
		const rootNode = await get(root);

		if (!tag) return rootNode;

		if (rootNode.hasOwnProperty(tag) && !latestCID) latestCID = rootNode[tag].obj;

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
 *
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
	} else await this.load({ dag, dagOwner });

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
		async save(tag: string, obj: object) {
			const rootCID = await this.dag.tx.add(tag, obj);
			this.rootCID = rootCID;
			const buffer = await this.dag.tx.commit();
			const r = await this.persist({ buffer });
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
		getInstance,
		persist,
		get,
		load // this.load is required in getInstance
	};
}
