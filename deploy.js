#!/usr/bin/env node

/**
 * For when you want to do a quick deploy of an esModule to an ArDag Tag
 * You need to supply an Arweave jwk .json file to write to Arweave
 *
 * src\lib\bundled\es\Web3WalletMenu.svelte.js
 * /src/lib/bundled/es/Web3WalletMenu.svelte.js
 *
 * test arlocal wallet
 * ../test-keyfile.json
 */

import { initializeArDag } from './package/index.js';
import { createDagRepo, DagRepo } from '@douganderson444/ipld-car-txs'; // build ipld one tx at a time
import Arweave from 'arweave';
import { post as bundlrPost } from './src/lib/bundlrHelpers/bundlr.js';

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import * as dotenv from 'dotenv'; // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
import { readyBundlr } from '@douganderson444/bundlr-helper';

dotenv.config(); //load from .env

const argv = yargs(hideBin(process.argv)).argv;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Get tag and esModule from cli args?
 * Create a repo
 * Fill it with the JWK's ArDag
 * Update/Add the given tag
 * Fin.
 */

(async () => {
	// read the ardag.config.js file
	const configPath = path.relative(__dirname, './ardag.config.js');

	// import configPath as es module
	const { config } = await import(`./${configPath}`);

	// if config doesn't exist, print an error and exit
	if (!config) {
		console.error('ardag.config.js not found');
		process.exit(1);
		return;
	}

	if (!config?.tag || !config?.obj || !config?.jwk) {
		console.log('Please supply a tag, obj, and jwk to use ArDag');
		process.exit(0);
		return;
	}

	const jwk = JSON.parse(fs.readFileSync(config.jwk.path, 'utf8'));

	let url = argv?.local
		? typeof argv?.local === 'string'
			? (url = new URL(argv?.local))
			: new URL('http://localhost:1984')
		: new URL('https://arweave.net:443');

	let arweave = Arweave.init({
		host: url.hostname,
		port: url.port,
		protocol: url.protocol.replace(':', ''),
		timeout: 20000,
		logging: false
	});

	const dagOwner = await arweave.wallets.jwkToAddress(jwk);

	if (argv?.local) {
		// async await faucet to the jwk
		console.log('fauceting', dagOwner);
		const response = await arweave.api.get(`/mint/${dagOwner}/1000000000000`);
		await arweave.api.get('mine');
		// console.log('response', response);
	}

	// post to Bundlr.network in production
	const post = argv?.local ? null : bundlrPost;
	const dag = await createDagRepo(); // make an empty dag repo for loading into
	const ardag = await initializeArDag({
		arweave,
		post
	});

	// add on to the existing stuff?
	let latest = null;
	try {
		latest = await ardag.get({ dagOwner, tag: config.tag });
	} catch (error) {
		// that's fine
	}

	const instance = await ardag.getInstance({ dag, wallet: jwk });

	let tagNode = {};
	// for each config.obj read file sync and save result to a variable
	for (const [key, val] of Object.entries(config.obj)) {
		// if the val has a path property, then read from that path as file
		if (val.path) {
			// console.log('Reading ', val.path);

			const file = fs.readFileSync(path.resolve(process.cwd(), val.path), 'utf8');

			// add to DAG, get CID
			const dataCid = await instance.dag.tx.pending.add({ value: file });

			// check if latest is the same cid as dataCid
			if (latest && latest[key]?.value.toString() === dataCid.toString()) {
				// dedupe actualy content, just keep the cid for ref
				console.log('Deduping', key, dataCid.toString());
				instance.dag.tx.pending.undo();
			}

			tagNode[key] = dataCid;
		} else {
			// console.log('Using ', val);
			tagNode[key] = val;
		}
	}

	tagNode.dappowner = dagOwner; // so consumers know which ArDag to find the dapp content if it's linked form somewhere else

	console.log('Read: ', tagNode);

	const value = config.overwrite && latest ? tagNode : Object.assign({}, latest, tagNode);

	// when non local, ensure Bundlr can cover the upload of > 100 kb
	if (!argv?.local) {
		const isReady = await readyBundlr(instance.dag.tx.pending.size, jwk);

		if (!isReady) {
			console.log('Save aborted');
			return;
		}
	}
	const rootCID = await instance.save(config.tag, value);
	console.log('Saved ', config.tag, ' to ', dagOwner);
})();
