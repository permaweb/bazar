// Minimal static server for a built dist. The app is a HashRouter SPA with base './',
// so every route resolves to index.html; unknown paths fall back to it as well.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const TYPES = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.mjs': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.woff': 'font/woff',
	'.woff2': 'font/woff2',
	'.ttf': 'font/ttf',
	'.otf': 'font/otf',
	'.ico': 'image/x-icon',
	'.wasm': 'application/wasm',
	'.map': 'application/json; charset=utf-8',
};

/**
 * Plain file server used by the comparer: screenshots are diffed inside Chromium (no image
 * dependency is installed), and they must be same-origin with the page or the canvas is tainted.
 */
export async function startFileServer(root) {
	const server = http.createServer((request, response) => {
		const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
		if (pathname === '/__blank.html') {
			response
				.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
				.end('<!doctype html><title>diff</title>');
			return;
		}
		const file = path.join(root, pathname);
		if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
			response.writeHead(404).end('not found');
			return;
		}
		const body = fs.readFileSync(file);
		response.writeHead(200, {
			'content-type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
			'cache-control': 'no-store',
			'content-length': body.length,
		});
		response.end(body);
	});
	await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
	const { port } = server.address();
	return {
		port,
		origin: `http://127.0.0.1:${port}`,
		async close() {
			await new Promise((resolve) => server.close(resolve));
		},
	};
}

export async function startServer(distDir) {
	const server = http.createServer((request, response) => {
		let pathname;
		try {
			pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
		} catch {
			pathname = '/';
		}
		// The harness never wants a service worker in the picture; refuse it at the server.
		if (pathname === '/service-worker.js') {
			response.writeHead(404).end('disabled');
			return;
		}
		let file = path.join(distDir, pathname);
		if (!file.startsWith(distDir)) file = path.join(distDir, 'index.html');
		if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(distDir, 'index.html');
		const body = fs.readFileSync(file);
		response.writeHead(200, {
			'content-type': TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
			'cache-control': 'no-store',
			'content-length': body.length,
		});
		response.end(body);
	});
	await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
	const { port } = server.address();
	return {
		port,
		origin: `http://127.0.0.1:${port}`,
		async close() {
			await new Promise((resolve) => server.close(resolve));
		},
	};
}
