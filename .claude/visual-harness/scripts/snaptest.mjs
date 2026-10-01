import { createPage, launchBrowser } from './lib/browser.mjs';
import { drivePage } from './lib/drive.mjs';
import { resolveDist } from './lib/env.mjs';
import { createNetCache, loadPool } from './lib/netcache.mjs';
import { startServer } from './lib/server.mjs';
import { collectSnapshot, expandSnapshot } from './lib/snapshot.mjs';
const server = await startServer(resolveDist('styles-base'));
const browser = await launchBrowser();
const cache = createNetCache({ mode: 'record', scenario: '__snaptest', appOrigin: server.origin, pool: loadPool() });
const { context, page } = await createPage(browser, { viewport: { width: 1440, height: 900 } });
await cache.attach(context);
await drivePage(page, {
	scenario: { route: '#/discover' },
	origin: server.origin,
	cache,
	mode: 'record',
	budgetMs: 120000,
});
const t0 = Date.now();
const raw = await page.evaluate(collectSnapshot, { appOrigin: server.origin });
console.log('collect ms', Date.now() - t0, 'bytes', raw.length);
const snap = JSON.parse(raw);
console.log(
	'meta',
	JSON.stringify(snap.meta.elementCount),
	'styleSets',
	snap.meta.styleSetCount,
	'strings',
	snap.meta.stringCount,
	'props',
	snap.properties.length
);
console.log(
	'generatedClasses sample',
	snap.meta.generatedClasses.slice(0, 15),
	'total',
	snap.meta.generatedClasses.length
);
console.log('styledKeyframes', snap.meta.styledKeyframes);
console.log('theme', snap.meta.theme, 'docH', snap.meta.documentHeight);
const exp = expandSnapshot(snap);
console.log('expanded keys', exp.byKey.size, 'duplicate keys', exp.duplicates.length, exp.duplicates.slice(0, 5));
console.log('sample keys:');
for (const k of [...exp.byKey.keys()].slice(0, 8)) console.log('  ', k);
const anyKey = [...exp.byKey.keys()].find((k) => k.includes('site-header'));
console.log('header key', anyKey);
await browser.close();
await server.close();
