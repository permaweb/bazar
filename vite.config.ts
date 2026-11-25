import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig, loadEnv, type Plugin, type ProxyOptions } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

function aoCoreProxy(mode: string): Record<string, ProxyOptions> {
	const { AO_CORE_PROXY_TARGET } = loadEnv(mode, process.cwd(), 'AO_CORE_PROXY_TARGET');
	const target = AO_CORE_PROXY_TARGET?.trim() || 'https://mystical.computer';

	const url = URL.canParse(target) ? new URL(target) : undefined;
	if (
		!url ||
		!['http:', 'https:'].includes(url.protocol) ||
		url.username ||
		url.password ||
		url.href !== `${url.origin}/`
	) {
		throw new TypeError('AO_CORE_PROXY_TARGET must be an HTTP or HTTPS origin.');
	}

	return {
		// Match root device routes, with or without an Arweave ID.
		'^/(?:[A-Za-z0-9_-]{43})?~[A-Za-z0-9_-]+@': { target: url.origin, changeOrigin: true },
	};
}

// Inject the analytics script only when a build or dev server opts in.
function analyticsScript(mode: string): Plugin {
	const { VITE_ANALYTICS_SRC } = loadEnv(mode, process.cwd(), 'VITE_ANALYTICS_SRC');
	const src = VITE_ANALYTICS_SRC?.trim();

	if (src) {
		const url = URL.canParse(src) ? new URL(src) : undefined;
		if (!url || url.protocol !== 'https:' || url.username || url.password) {
			throw new TypeError('VITE_ANALYTICS_SRC must be an HTTPS URL.');
		}
	}

	return {
		name: 'bazar-analytics-script',
		transformIndexHtml() {
			if (!src) return;
			return [{ tag: 'script', attrs: { async: true, src }, injectTo: 'body' }];
		},
	};
}

export default defineConfig(({ command, isPreview, mode }) => ({
	base: './',
	plugins: [
		nodePolyfills({
			include: ['buffer', 'crypto', 'process', 'stream', 'util'],
			protocolImports: true,
		}),
		react(),
		analyticsScript(mode),
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
		proxy: command === 'serve' && !isPreview ? aoCoreProxy(mode) : undefined,
	},
}));
