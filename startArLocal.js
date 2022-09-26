/*
Starts a local instance of ArLocal and starts the SvelteKit Dev process too
*/

import ArLocal from 'arlocal'; // Arweave local testnet

export async function serveArLocal() {
	const arLocal = new ArLocal.default();

	await arLocal.start();

	async function toExit() {
		if (arLocal) await arLocal.stop();
		process.exit(0);
	}

	const p = await import('child_process');

	// p.spawn('npm', ['run', 'dev'], {
	// 	stdio: ['ignore', 'inherit', 'inherit'],
	// 	shell: true
	// });

	process.on('SIGTERM', toExit);
	process.on('exit', toExit);
}

serveArLocal();
