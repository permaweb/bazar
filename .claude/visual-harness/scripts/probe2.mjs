import { CHROMIUM, loadPlaywright, resolveDist } from './lib/env.mjs';
import { startServer } from './lib/server.mjs';

const route = process.argv[2] || '#/discover';
const dist = resolveDist(process.argv[3] || 'styles-base');
const { chromium } = await loadPlaywright();
const server = await startServer(dist);
const browser = await chromium.launch({ executablePath: CHROMIUM, headless: true });
const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
page.on('console', (m) => console.log(`[console:${m.type()}] ${m.text().slice(0, 300)}`));
page.on('pageerror', (e) => console.log(`[pageerror] ${String(e).slice(0, 500)}`));
page.on('requestfailed', (r) =>
	console.log(`[failed] ${r.method()} ${r.url().slice(0, 140)} ${r.failure()?.errorText}`)
);

await page.goto(`${server.origin}${route}`, { waitUntil: 'load' });
await page.waitForTimeout(15000);
console.log('=== URL ===', page.url());
console.log('=== body text (2000) ===');
console.log((await page.evaluate(() => document.body.innerText)).slice(0, 2000));
console.log('=== links ===');
console.log(
	JSON.stringify(
		await page.evaluate(() =>
			[...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')).slice(0, 60)
		),
		null,
		1
	)
);
await browser.close();
await server.close();
