import * as ArDag from '@douganderson444/ardag'; // this library
import { createDagRepo } from '@douganderson444/ipld-car-txs'; // build ipld one tx at a time
import Arweave from 'arweave';

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

const defaultLogger = { log: (s) => true };

export async function tests(serverUrl?: string, logger?: object = defaultLogger): boolean {
	let post, wallet, rootCID;

	// destructure serverUrl up into host, port, protocol
	let { host, port, protocol } = new URL(serverUrl);
	// remove colon and port from host
	host = host.replace(`:${port}`, '') || 'localhost';
	port = port || 443;
	protocol = protocol.replace(':', '');
	logger.log({ host, port, protocol });

	if (dev) {
		// Save this buffer as an Arweave Contract Transaction
		arweave = Arweave.init({
			host,
			port,
			protocol,
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
			// logger.log(`Mined ${tx.id}`);
			return resp;
		};
	} else {
		arweave = Arweave.initializeArDag({});
		// use Bunldr for production
		await generateRsaJwk();
		post = wallet.arweaveWalletAPI.dispatch; // need to have browser open to approve confirmation if > 100kb
	}

	const dag = await createDagRepo({ path: 'original-dag' }); // make a barebones dag repo for fast loading

	let tag = 'Mobile';
	let tag2 = 'Landline';
	let v1 = { number: '555-1234' };
	let v2 = { number: '212-555-1234' };
	let v3 = { number: '+1-212-555-1234' };
	let v4 = { number: '+1-555-555-5555' };

	const ardag = ArDag.initializeArDag({ arweave, post });

	// create a contract if you don't have one
	// const contractId = await ardag.generateContract(wallet.jwk); // uses wallet if no jwk specified
	const myArDag = await ardag.getInstance({ wallet: wallet.jwk, dag }); // has contractId and wallet properties

	rootCID = await myArDag.save(tag, v1);
	rootCID = await myArDag.save(tag2, v4);
	rootCID = await myArDag.save(tag, v2);

	// get address from jwk
	const address = await arweave.wallets.getAddress(wallet.jwk);

	// try shortcut
	let latest = await ardag.get({ dagOwner: address, tag });
	JSON.stringify(latest) == JSON.stringify(v2) ? console.log('Pass') : console.log('Fail');

	// try deep nested value saved a while ago
	let latest2 = await ardag.get({ dagOwner: address, tag: tag2 });
	JSON.stringify(latest2) == JSON.stringify(v4) ? console.log('Pass') : console.log('Fail');

	// now read the buffers from Arweave and load them into a new dag, see if they match
	const rebuiltDag = await createDagRepo({ path: 'rebuiltDag' }); // make a barebones dag repo for fast loading

	// load a Dag with existing data from contractId

	await ardag.load({ dag: rebuiltDag, dagOwner: address });

	const rebuiltPrev = (await rebuiltDag.get(rootCID, { path: `/${tag}/prev/obj/number` })).value;
	logger.log(`v1: ${rebuiltPrev}, match: ${v1.number == rebuiltPrev}`);

	const rebuiltCurrent = (await rebuiltDag.get(rootCID, { path: `/${tag}/obj/number` })).value;
	logger.log(`v2: ${rebuiltCurrent}, match: ${v2.number == rebuiltCurrent}`);

	// I can get an instance based on an existing contract, too
	const newDag = await createDagRepo({ path: 'new-dag' });
	const myNewArDag = await ardag.getInstance({
		wallet: wallet.jwk, // use the same wallet as only the owner can publish updates
		contractId: myArDag.contractId, // use existing contractId to pick up where we left off
		dag: newDag // use a new dag repo to show that all transactions have been imported fresh
	});

	// I can use the existing contractId to add more date to both dag and arweave
	rootCID = await myNewArDag.save(tag, v3);

	const rebuiltCurrentLatest = (await myNewArDag.dag.get(rootCID, { path: `/${tag}/obj/number` }))
		.value;
	logger.log(`v3: ${rebuiltCurrentLatest}, match: ${v3.number == rebuiltCurrentLatest}`);

	const rcLatest = await myNewArDag.latest(tag);
	logger.log(`v3.1: ${rcLatest.number}, match: ${v3.number == rcLatest.number}`);

	return `Pass tests.`;
}
