// One-off: load a route and dump every non-app-origin request so the cache key design is informed.
import { CHROMIUM, loadPlaywright, resolveDist } from './lib/env.mjs';
import { startServer } from './lib/server.mjs';

const route = process.argv[2] || '#/discover';
const dist = resolveDist(process.argv[3] || 'styles-base');
const { chromium } = await loadPlaywright();
const server = await startServer(dist);
const browser = await chromium.launch({ executablePath: CHROMIUM, headless: true });
const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

const seen = [];
page.on('request', (request) => {
	const url = request.url();
	if (url.startsWith(server.origin) || url.startsWith('data:') || url.startsWith('blob:')) return;
	let body = null;
	try {
		body = request.postData();
	} catch {
		body = '<binary>';
	}
	seen.push({
		method: request.method(),
		url,
		resourceType: request.resourceType(),
		contentType: request.headers()['content-type'] ?? '',
		bodyLength: body ? body.length : 0,
		bodyPreview: body ? body.slice(0, 300) : null,
	});
});

await page.goto(`${server.origin}${route}`, { waitUntil: 'load' });
await page.waitForTimeout(12000);

const byOrigin = {};
for (const entry of seen) {
	const origin = new URL(entry.url).origin;
	byOrigin[origin] = (byOrigin[origin] ?? 0) + 1;
}
console.log('=== request count by origin ===');
console.log(JSON.stringify(byOrigin, null, 2));
console.log('=== total ===', seen.length);
console.log('=== distinct method+url ===', new Set(seen.map((e) => `${e.method} ${e.url}`)).size);
console.log('=== sample (first 40) ===');
for (const entry of seen.slice(0, 40)) {
	console.log(
		`${entry.method} ${entry.url.slice(0, 160)} [${entry.resourceType}] ct=${entry.contentType} len=${
			entry.bodyLength
		}`
	);
	if (entry.bodyPreview) console.log(`    body: ${entry.bodyPreview.replace(/\n/g, ' ').slice(0, 260)}`);
}
console.log('=== POST entries ===');
for (const entry of seen.filter((e) => e.method === 'POST').slice(0, 20)) {
	console.log(`${entry.url.slice(0, 160)} ct=${entry.contentType} len=${entry.bodyLength}`);
	if (entry.bodyPreview) console.log(`    body: ${entry.bodyPreview.replace(/\n/g, ' ').slice(0, 400)}`);
}

await browser.close();
await server.close();
