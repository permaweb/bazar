import react from '@vitejs/plugin-react';
import path from 'path';
import polyfillNode from 'rollup-plugin-polyfill-node';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import svgr from 'vite-plugin-svgr';

// Mainnet addresses (default for this branch)
const productionAddresses = {
	MODULE: 'ISShJH1ij-hPPt9St5UFFr_8Ys3Kj5cyg7zrMGt7H9s', // Mainnet AOS Module
	SCHEDULER: 'n_XZJhUnmldNFo4dhajoPZWhBXuJk-OcQr5JQ49c4Zo', // Mainnet scheduler (schedule.forward.computer)
	DEFAULT_TOKEN: 'xU9zFkq3X2ZQ6olwNVvr1vUWIjc3kXTWr7xKQD6dh10',
	UCM: 'hqdL4AZaFZ0huQHbAsYxdTwG6vpibK7ALWKNzmWaD4Q',
	UCM_ACTIVITY: '7_psKu3QHwzc2PFCJk2lEwyitLJbz6Vj7hOcltOulj4',
	PIXL: 'DM3FoZUq_yebASPhgd8pEIRIzDW6muXEhxz5-JwbZwo',
	PROFILE_REGISTRY: 'SNy4m-DrqxWl01YqGM4sxI8qCni-58re8uuJLvZPypY',
	PROFILE_SRC: '_R2XYWDPUXVvQrQKFaQRvDTDcDwnQNbqlTd_qvCRSpQ',
	COLLECTIONS_REGISTRY: 'Kv6jQCcs8GwNpioj6tkTt06zD130YgqIHX7QNnZQYQc',
	VOUCH: 'ZTTO02BL2P-lseTLUgiIPD9d0CF1sc4LbMA2AQ7e9jo',
	STAMPS: 'LaC2VtxqGekpRPuJh-TkI_ByAqCS2_KB3YuhMJ5yBtc',
};

// Legacy addresses (for fallback/testing)
const nonProductionAddresses = {
	MODULE: 'Pq2Zftrqut0hdisH_MC2pDOT6S4eQFoxGsFUzR6r350', // Legacy module
	SCHEDULER: '_GQ33BkPtZrqxA84vM8Zk-N2aO0toNNu_C-l-rawrBA', // Legacy scheduler
	DEFAULT_TOKEN: 'xU9zFkq3X2ZQ6olwNVvr1vUWIjc3kXTWr7xKQD6dh10',
	UCM: 'CDxd81DDaJvpzxoyhXn-dVnZhYIFQEKU8FeUHdktFgQ',
	UCM_ACTIVITY: 'W45ki8vJ0TcsxZAGZIbGj3k38595TA0HfZwCOaqhOa0',
	PIXL: 'DM3FoZUq_yebASPhgd8pEIRIzDW6muXEhxz5-JwbZwo',
	PROFILE_REGISTRY: 'SNy4m-DrqxWl01YqGM4sxI8qCni-58re8uuJLvZPypY',
	PROFILE_SRC: '9Tpz5_ZT4RRkF-6JUTdaaTMg0ARfkNuuM5zahXyCqZ4',
	COLLECTIONS_REGISTRY: '1oBtIRAmhLVJFABGKYlhcsACjyh36ahSJ-4lJEuvgzA',
	VOUCH: 'ZTTO02BL2P-lseTLUgiIPD9d0CF1sc4LbMA2AQ7e9jo',
	STAMPS: 'LaC2VtxqGekpRPuJh-TkI_ByAqCS2_KB3YuhMJ5yBtc',
};

export default defineConfig(({ mode }) => {
	const env = process.env.NODE_ENV || 'development';
	const isProduction = env === 'production';
	const isStaging = env === 'staging';

	// Support switching between mainnet and legacy via VITE_AO env var
	// Default to mainnet for this branch
	const aoMode = process.env.VITE_AO || 'mainnet';
	const useMainnet = aoMode === 'mainnet';

	const addresses = useMainnet ? productionAddresses : nonProductionAddresses;

	return {
		root: './',
		base: './',
		plugins: [
			nodePolyfills({
				protocolImports: true,
			}),
			react(),
			svgr({
				svgrOptions: {
					icon: true,
				},
			}),
		],
		resolve: {
			alias: {
				'@permaweb/ucm': path.resolve(__dirname, 'node_modules/@permaweb/ucm/dist/index.esm.js'),
				api: path.resolve(__dirname, 'src/api'),
				app: path.resolve(__dirname, 'src/app'),
				arweave: path.resolve(__dirname, 'node_modules/arweave'),
				assets: path.resolve(__dirname, 'src/assets'),
				components: path.resolve(__dirname, 'src/components'),
				helpers: path.resolve(__dirname, 'src/helpers'),
				hooks: path.resolve(__dirname, 'src/hooks'),
				navigation: path.resolve(__dirname, 'src/navigation'),
				providers: path.resolve(__dirname, 'src/providers'),
				root: path.resolve(__dirname, 'src/root'),
				routes: path.resolve(__dirname, 'src/routes'),
				store: path.resolve(__dirname, 'src/store'),
				views: path.resolve(__dirname, 'src/views'),
				wallet: path.resolve(__dirname, 'src/wallet'),
				wrappers: path.resolve(__dirname, 'src/wrappers'),
				process: 'vite-plugin-node-polyfills/polyfills/process-es6',
				buffer: 'vite-plugin-node-polyfills/polyfills/buffer',
				crypto: 'vite-plugin-node-polyfills/polyfills/crypto',
				stream: 'vite-plugin-node-polyfills/polyfills/stream',
				util: 'vite-plugin-node-polyfills/polyfills/util',
				path: 'vite-plugin-node-polyfills/polyfills/path',
				events: 'vite-plugin-node-polyfills/polyfills/events',
				timers: 'vite-plugin-node-polyfills/polyfills/timers',
				http: 'vite-plugin-node-polyfills/polyfills/http',
				https: 'vite-plugin-node-polyfills/polyfills/https',
				os: 'vite-plugin-node-polyfills/polyfills/os',
				assert: 'vite-plugin-node-polyfills/polyfills/assert',
				zlib: 'vite-plugin-node-polyfills/polyfills/zlib',
				constants: 'vite-plugin-node-polyfills/polyfills/constants',
			},
		},
		optimizeDeps: {
			include: ['buffer', 'process', 'crypto', 'stream', 'util'],
		},
		define: {
			'process.env.MODULE': JSON.stringify(addresses.MODULE),
			'process.env.SCHEDULER': JSON.stringify(addresses.SCHEDULER),
			'process.env.DEFAULT_TOKEN': JSON.stringify(addresses.DEFAULT_TOKEN),
			'process.env.UCM': JSON.stringify(addresses.UCM),
			'process.env.UCM_ACTIVITY': JSON.stringify(addresses.UCM_ACTIVITY),
			'process.env.PIXL': JSON.stringify(addresses.PIXL),
			'process.env.PROFILE_REGISTRY': JSON.stringify(addresses.PROFILE_REGISTRY),
			'process.env.PROFILE_SRC': JSON.stringify(addresses.PROFILE_SRC),
			'process.env.COLLECTIONS_REGISTRY': JSON.stringify(addresses.COLLECTIONS_REGISTRY),
			'process.env.VOUCH': JSON.stringify(addresses.VOUCH),
			'process.env.STAMPS': JSON.stringify(addresses.STAMPS),
			'process.version': JSON.stringify('v18.0.0'),
			'process.browser': JSON.stringify(true),
		},
		build: {
			sourcemap: false,
			outDir: path.resolve(__dirname, 'dist'),
			emptyOutDir: true,
			commonjsOptions: {
				transformMixedEsModules: true,
			},
			rollupOptions: {
				input: path.resolve('', 'index.html'),
				plugins: [
					polyfillNode(),
					{
						name: 'copy-service-worker',
						writeBundle() {
							const fs = require('fs');
							const swPath = path.resolve(__dirname, 'public/service-worker.js');
							const outPath = path.resolve(__dirname, 'dist/service-worker.js');
							if (fs.existsSync(swPath)) {
								fs.copyFileSync(swPath, outPath);
								console.log('Service worker copied to dist');
							}
						},
					},
				],
				// output: {
				// 	manualChunks: (id: string) => {
				// 		if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
				// 			return 'vendor';
				// 		}
				// 		if (id.includes('@permaweb/aoconnect')) {
				// 			return 'ao-connect';
				// 		}
				// 		if (id.includes('@permaweb/libs') || id.includes('arweave')) {
				// 			return 'permaweb-libs';
				// 		}
				// 		if (id.includes('react-svg') || id.includes('react-markdown')) {
				// 			return 'utils';
				// 		}

				// 		return undefined;
				// 	},
				// },
			},
		},
		server: {
			open: false,
			strictPort: true,
			hmr: true,
			port: 3000,
		},
	};
});
