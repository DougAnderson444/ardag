import { describe, it, assert, expect, test, beforeAll, afterAll } from 'vitest';
import { createDagRepo, DagRepo } from '@douganderson444/ipld-car-txs'; // build ipld one tx at a time
import { setup } from './utils';
import ArLocal from 'arlocal';

describe('Integrated ardag', () => {
	let rootCID;
	let dag;
	let myArDag;

	let ardag, wallet, arweave, address;
	let arlocal: ArLocal;

	let tag = 'Mobile';
	let tag2 = 'A Landline/Phone';
	let v1 = { number: '555-1234' };
	let v2 = { number: '212-555-1234' };
	let v3 = { number: '+1-212-555-1234' };
	let v4 = { number: '+1-555-555-5555' };

	beforeAll(async () => {
		arlocal = new ArLocal();
		await arlocal.start();

		({ ardag, wallet, arweave } = await setup({
			dev: true,
			serverUrl: 'http://localhost:1984',
			logger: { log: (s) => true }
		}));

		address = await arweave.wallets.getAddress(wallet.jwk);

		dag = await createDagRepo(); // make a barebones dag repo for fast loading
	});

	afterAll(async () => {
		await arlocal.stop();
	});

	it('should create a DagRepo', async () => {
		expect(dag).toBeInstanceOf(DagRepo);
	});

	it('should create an ardag instance', async () => {
		// expect wallet.jwk toBeTruthy
		expect(wallet.jwk).toBeTruthy();

		myArDag = await ardag.getInstance({ dag, wallet: wallet.jwk });
		// expect myArDag  to have arweave, post, getInstance, get, and load properties
		expect(myArDag).toHaveProperty('arweave');
		expect(myArDag).toHaveProperty('post');
		expect(myArDag).toHaveProperty('dag');
		expect(myArDag).toHaveProperty('load');
		expect(myArDag).toHaveProperty('rootCID');
	});

	it('should save some stuff', async () => {
		rootCID = await myArDag.save(tag, v1);
		expect(rootCID).toBeTruthy();
		rootCID = await myArDag.save(tag2, v4);
		expect(rootCID).toBeTruthy();
		rootCID = await myArDag.save(tag, v2);
		expect(rootCID).toBeTruthy();
	});

	// it should use lastest api
	it('should use latest api', async () => {
		// ardag should be toBeTruthy
		expect(ardag).toBeTruthy();
		//address too
		expect(address).toBeTruthy();
		// tag too
		expect(tag).toBeTruthy();

		let latest = await ardag.get({ dagOwner: address, tag });
		expect(latest).toEqual(v2);

		let latest2 = await ardag.get({ dagOwner: address, tag: tag2 });
		expect(latest2).toEqual(v4);
	});

	it('should rebuild an exact dag copy', async () => {
		const rebuiltDag = await createDagRepo({ path: 'rebuiltDag' });
		await ardag.load({ dag: rebuiltDag, dagOwner: address });

		const rebuiltPrev = (await rebuiltDag.get(rootCID, { path: `/${tag}/prev/obj/number` })).value;
		expect(rebuiltPrev).toEqual(v1.number);

		const rebuiltCurrent = (await rebuiltDag.get(rootCID, { path: `/${tag}/obj/number` })).value;
		expect(rebuiltCurrent).toEqual(v2.number);
	});

	it('should get an instance based on an existing contract, too', async () => {
		const newDag = await createDagRepo({ path: 'new-dag' });
		const myNewArDag = await ardag.getInstance({
			wallet: wallet.jwk, // use the same wallet as only the owner can publish updates
			contractId: myArDag.contractId, // use existing contractId to pick up where we left off
			dag: newDag // use a new dag repo to show that all transactions have been imported fresh
		});

		rootCID = await myNewArDag.save(tag, v3);
		const rebuiltCurrentLatest = (await myNewArDag.dag.get(rootCID, { path: `/${tag}/obj/number` }))
			.value;
		expect(rebuiltCurrentLatest).toEqual(v3.number);
		const rcLatest = await myNewArDag.latest(tag);
		expect(rcLatest.number).toEqual(v3.number);
	});

	it('should load someone elses ArDag too', async () => {
		const newDag = await createDagRepo({ path: 'reloaded-dag' });
		// const dagOwner = await ardag.arweave.wallets.getAddress(wallet.jwk);
		const theirArDag = await ardag.getInstance({
			dagOwner: address, // use the Arweave address
			dag: newDag // use a new dag repo to show that all transactions have been imported fresh
		});

		const latest = await theirArDag.latest(tag);
		// expect latest to be v3
		expect(latest).toEqual(v3);
	});
});
