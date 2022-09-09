import { sveltekit } from '@sveltejs/kit/vite';
import type { UserConfig } from 'vite';
import path from 'path';

const config: UserConfig = {
	plugins: [sveltekit()],
	server: {
		fs: {
			strict: false
		}
	},
	resolve: {
		alias: {
			'@douganderson444/ardag': path.resolve('src/lib')
		}
	}
	// optimizeDeps: {
	// 	include: ['@douganderson444/ipld-car-txs']
	// },
	// ssr: { noExternal: ['@douganderson444/ipld-car-txs/**'] } // does the trick
};

export default config;
