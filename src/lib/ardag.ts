import type { CreateTransactionInterface } from 'arweave/node/common';
import type { JWKInterface } from 'arweave/node/lib/wallet';
import type Transaction from 'arweave/node/lib/transaction';
import { encode } from '@douganderson444/ipld-car-txs'; // build ipld one tx at a time
import type { DagRepo } from '@douganderson444/ipld-car-txs'; // build ipld one tx at a time

import defaultContractSrc from './contract/contractSrc.js?raw';
import state from './contract/initial-state.json';

// https://github.com/ArweaveTeam/SmartWeave/blob/4d09c66d832091805f583ba73e8da96cde2c0190/src/contract-interact.ts#L291
// not exported by arweave-js, so re-written here
export async function createTx(
	contractId: string,
	input: any,
	tags?: { name: string; value: string }[] = [],
	target?: string = '',
	winstonQty?: string = '0',
	reward?: string
): Promise<Transaction> {
	const options: Partial<CreateTransactionInterface> = {
		data: Math.random().toString().slice(-4),
		reward
	};

	if (target && target.length) {
		options.target = target.toString();
		if (winstonQty && +winstonQty > 0) {
			options.quantity = winstonQty.toString();
		}
	}

	const interactionTx = await this.arweave.createTransaction(options, this.wallet);

	if (!input) {
		throw new Error(`Input should be a truthy value: ${JSON.stringify(input)}`);
	}

	if (tags && tags.length) {
		for (const tag of tags) {
			interactionTx.addTag(tag.name.toString(), tag.value.toString());
		}
	}
	interactionTx.addTag('App-Name', 'SmartWeaveAction');
	interactionTx.addTag('App-Version', '0.3.0');
	interactionTx.addTag('Contract', contractId);
	interactionTx.addTag('Input', JSON.stringify(input));

	await this.arweave.transactions.sign(interactionTx, this.wallet);
	return interactionTx;
}

export async function getAddress(wallet?: JWKInterface | 'use_wallet'): Promise<string> {
	return await this.arweave.wallets.getAddress(wallet);
}

export async function getInstance({
	wallet = null,
	dag = null,
	options = {},
	owner = false,
	source = false,
	contractId = false // load existing contract, or create a new one
}: {
	dag?: DagRepo;
	wallet?: JWKInterface | 'use_wallet';
	owner?: string | false;
	source?: string;
}): Promise<string> {
	// make some reasonable defaults for people
	state.owner = options?.owner || (await this.getAddress(wallet));
	if (!state.owner) throw new Error('Contract must be owned by the Base64 JWK of a wallet');
	if (!dag)
		throw new Error('Supply a DagRepo from https://github.com/DougAnderson444/ipld-car-txs');
	if (!contractId)
		contractId = await this.createContract(
			this.arweave,
			wallet,
			options?.source || defaultContractSrc,
			JSON.stringify(state)
		);

	return {
		arweave: this.arweave, // inherit this from parent object
		post: this.post, // inherit this from parent object
		contractId,
		wallet,
		dag,
		update,
		createTx,
		async save(tag: string, obj: object) {
			const rootCID = await this.dag.tx.add(tag, obj);
			const savedBuffer = await this.dag.tx.commit();
			const { cid: carCid } = await encode(savedBuffer);

			// create an Arweave data transaction
			let tx = await this.arweave.createTransaction({ data: savedBuffer });

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
			await this.arweave.transactions.sign(tx, this.wallet);
			await this.post(tx);
			await this.update(tx.id);
			return rootCID;
		}
	};
}

// smartweave without the post
/**
 * Create a new contract from a contract source file and an initial state.
 * Returns the contract id.
 *
 * @param arweave       an Arweave client instance
 * @param wallet        a wallet private or public key
 * @param contractSrc   the contract source as string.
 * @param initState     the contract initial state, as a JSON string.
 */
export async function createContract(
	arweave: Arweave,
	wallet: JWKInterface | 'use_wallet',
	contractSrc: string,
	initState: string,
	reward?: string
): Promise<string> {
	const srcTx = await arweave.createTransaction({ data: contractSrc, reward }, wallet);

	srcTx.addTag('App-Name', 'SmartWeaveContractSource');
	srcTx.addTag('App-Version', '0.3.0');
	srcTx.addTag('Content-Type', 'application/javascript');

	await arweave.transactions.sign(srcTx, wallet);

	const response = await this.post(srcTx);

	if (response.status === 200 || response.status === 208) {
		return await this.createContractFromTx(arweave, wallet, srcTx.id, initState);
	} else {
		throw new Error(
			`Unable to write Contract Source: ${JSON.stringify(response?.statusText ?? '')}`
		);
	}
}

/**
 * Create a new contract from an existing contract source tx, with an initial state.
 * Returns the contract id.
 *
 * @param arweave   an Arweave client instance
 * @param wallet    a wallet private or public key
 * @param srcTxId   the contract source Tx id.
 * @param state     the initial state, as a JSON string.
 * @param tags          an array of tags with name/value as objects.
 * @param target        if needed to send AR to an address, this is the target.
 * @param winstonQty    amount of winston to send to the target, if needed.
 */
export async function createContractFromTx(
	arweave: Arweave,
	wallet: JWKInterface | 'use_wallet',
	srcTxId: string,
	state: string,
	tags: { name: string; value: string }[] = [],
	target: string = '',
	winstonQty: string = '',
	reward?: string
): Promise<string> {
	let contractTX = await arweave.createTransaction({ data: state, reward }, wallet);

	if (target && winstonQty && target.length && +winstonQty > 0) {
		contractTX = await arweave.createTransaction(
			{
				data: state,
				target: target.toString(),
				quantity: winstonQty.toString(),
				reward
			},
			wallet
		);
	}

	if (tags && tags.length) {
		for (const tag of tags) {
			contractTX.addTag(tag.name.toString(), tag.value.toString());
		}
	}
	contractTX.addTag('App-Name', 'SmartWeaveContract');
	contractTX.addTag('App-Version', '0.3.0');
	contractTX.addTag('Contract-Src', srcTxId);
	contractTX.addTag('Content-Type', 'application/json');

	await arweave.transactions.sign(contractTX, wallet);

	const response = await this.post(contractTX);

	if (response.status === 200 || response.status === 208) {
		return contractTX.id;
	} else {
		throw new Error('Unable to write Contract Initial State');
	}
}
/**
 * Updates an existing Areave Contract with a new state.ardagtxid
 */
export async function update(ardagtxid: string): Promise<void> {
	// Create, Sign, Post
	const tx = await this.createTx(this.contractId, { function: 'ArDagTx', ardagtxid });
	await this.arweave.transactions.sign(tx, this.wallet);
	await this.post(tx);
}

// creates a new ArDag object
export function init({ arweave, post = null }) {
	if (!arweave) throw new Error('Arweave instance must be provided');
	// need to bind transactions.post to arweave.transactions as *this*
	const doPost = arweave.transactions.post;
	const boundPost = doPost.bind(arweave.transactions);

	return {
		arweave,
		post: post || boundPost,
		getInstance,
		getAddress, // this.getAddress is required in getInstance
		createContract, // this.createContract is required in getInstance
		createContractFromTx // this.createContractFromTx is required in createContract
	};
}
