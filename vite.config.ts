import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

import { sourceAliases } from './scripts/source-aliases';

export default defineConfig({
	base: './',
	plugins: [
		nodePolyfills({
			include: ['buffer', 'crypto', 'process', 'stream', 'util'],
			protocolImports: true,
		}),
		react(),
	],
	resolve: {
		dedupe: ['react', 'react-dom'],
		alias: sourceAliases,
	},
	build: {
		outDir: 'dist',
		emptyOutDir: true,
		sourcemap: false,
		rollupOptions: {
			output: {
				// Lazy entries resolve through folder barrels; name their chunks after the folder, not `index`.
				chunkFileNames(chunk) {
					const entry = chunk.facadeModuleId ?? '';
					const base = path.basename(entry).replace(/\.[^.]+$/, '');
					const fromSource = entry.includes(`${path.sep}src${path.sep}`);
					const name = fromSource && base === 'index' ? path.basename(path.dirname(entry)) : chunk.name;
					return `assets/${name}-[hash].js`;
				},
				manualChunks(id) {
					if (!id.includes('node_modules') && !id.includes('/vendor/')) return;
					if (id.includes('/three/')) return 'graphics';
					if (id.includes('/arweave/')) return 'arweave';
					if (id.includes('/ao.js/')) return 'ao';
					if (id.includes('weave-wrangler')) return 'transactions';
					if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/react-router'))
						return 'react';
					if (id.includes('/styled-components/')) return 'styles';
				},
			},
		},
	},
	server: {
		host: '127.0.0.1',
		port: 3000,
		strictPort: true,
	},
});
