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
			'@douganderson444/ardag': path.resolve('./')
		}
	},
	test: {
		deps: {
			inline: ['@douganderson444/ipld-car-txs']
		},
		hookTimeout: 60000
	}
};

export default config;
