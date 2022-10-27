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

dotenv.config(); //load from .env

const argv = yargs(hideBin(process.argv)).argv;

const __filename = fileURLToPath(import.meta.url);

/**
 * Get tag and esModule from cli args?
 * Create a repo
 * Fill it with the JWK address's ArDag
 * Update/Add the given tag
 * Fin.
 */

(async () => {
	if (!argv.tag || !argv.obj || !argv.jwk) {
		console.log('Please supply --tag, --obj, and --jwk args');
		return;
	}

	let values = {};
	// for each argv.obj read file sync and save result to a variable
	for (const [key, file] of Object.entries(argv.obj)) {
		console.log('Reading ', file);
		const value = fs.readFileSync(file, 'utf8');
		values[key] = value;
	}

	console.log('Read: ', values);

	const jwk = JSON.parse(fs.readFileSync(argv.jwk, 'utf8'));

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

	console.log('config', arweave.api.config);
	const address = await arweave.wallets.jwkToAddress(jwk);

	if (argv?.local) {
		// async await faucet to the jwk address
		console.log('fauceting', address);
		const response = await arweave.api.get(`/mint/${address}/1000000000000`);
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
	const latest = await ardag.get({ dagOwner: address, tag: argv.tag });

	const value = argv.overwrite ? values : Object.assign({}, latest, values);

	const instance = await ardag.getInstance({ dag, wallet: jwk });
	const rootCID = await instance.save(argv.tag, value);
	console.log('Saved ', argv.tag, ' to ', address);
})();
