import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

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
		alias: {
			api: path.resolve(__dirname, 'src/api'),
			components: path.resolve(__dirname, 'src/components'),
			helpers: path.resolve(__dirname, 'src/helpers'),
			hooks: path.resolve(__dirname, 'src/hooks'),
			navigation: path.resolve(__dirname, 'src/navigation'),
			providers: path.resolve(__dirname, 'src/providers'),
		},
	},
	build: {
		outDir: 'dist',
		emptyOutDir: true,
		sourcemap: false,
		rollupOptions: {
			output: {
				manualChunks(id) {
					if (!id.includes('node_modules') && !id.includes('/vendor/')) return;
					if (id.includes('/three/')) return 'graphics';
					if (id.includes('/arweave/')) return 'arweave';
					if (id.includes('weave-wrangler')) return 'transactions';
					if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/react-router')) return 'react';
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
