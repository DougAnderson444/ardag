import { initializeArDag } from './index'; // this library
import Arweave from 'arweave';

let arweave;

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

export async function setup({
	dev = true,
	serverUrl = 'http://localhost:1984',
	logger = defaultLogger
}) {
	let post, wallet;

	// destructure serverUrl up into host, port, protocol
	let { host, port, protocol } = new URL(serverUrl);
	// remove colon and port from host
	host = host.replace(`:${port}`, '') || 'localhost';
	port = port || 443;
	protocol = protocol.replace(':', '');
	logger.log({ host, port, protocol, Arweave });

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
		arweave = Arweave.init({});
		// use Bunldr for production
		await generateRsaJwk();
		post = wallet.arweaveWalletAPI.dispatch; // need to have browser open to approve confirmation if > 100kb
	}

	const ardag = initializeArDag({ arweave, post });

	return { ardag, wallet, arweave };
}
