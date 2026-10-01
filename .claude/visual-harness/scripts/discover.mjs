// Walk the built app and harvest real ids for the scenario list. Writes ids.json.
// Runs against the live network in record mode, seeding the shared response pool so the
// per-scenario recordings that follow re-use these responses instead of re-hitting the gateways.
import fs from 'node:fs';
import path from 'node:path';

import { createPage, launchBrowser } from './lib/browser.mjs';
import { drivePage } from './lib/drive.mjs';
import { DATA_ROOT, ensureDirs, resolveDist } from './lib/env.mjs';
import { createNetCache, loadPool } from './lib/netcache.mjs';
import { startServer } from './lib/server.mjs';

const target = process.argv[2] || 'styles-base';
const dist = resolveDist(target);
ensureDirs();

const pool = loadPool();
const server = await startServer(dist);
const browser = await launchBrowser();

async function visit(route, collect) {
	const cache = createNetCache({
		mode: 'record',
		scenario: `__discover-${route.replace(/[^a-z0-9]+/gi, '-')}`,
		appOrigin: server.origin,
		pool,
		log: () => {},
	});
	const { context, page } = await createPage(browser, { viewport: { width: 1440, height: 900 } });
	await cache.attach(context);
	await drivePage(page, { scenario: { route }, origin: server.origin, cache, mode: 'record', budgetMs: 900_000 });
	const result = await page.evaluate(collect);
	cache.save();
	console.log(
		`  ${route}: recorded=${cache.stats.recorded} reused=${cache.stats.reused} served=${cache.stats.served}`
	);
	await context.close();
	return result;
}

const hrefCollector = () =>
	[...document.querySelectorAll('a[href]')].map((anchor) => anchor.getAttribute('href') ?? '');

console.log('discovering ids…');

const found = { collections: [], assets: [], profiles: [], audioAssets: [] };

for (const route of ['#/discover', '#/collections', '#/activity']) {
	const hrefs = await visit(route, hrefCollector);
	for (const href of hrefs) {
		const collection = href.match(/#\/collection\/([A-Za-z0-9_-]{10,})$/);
		if (collection) found.collections.push(collection[1]);
		const asset = href.match(/#\/asset\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]{10,})$/);
		if (asset) found.assets.push(`${asset[1]}/${asset[2]}`);
		const profile = href.match(/#\/profile\/([A-Za-z0-9_-]{43})$/);
		if (profile) found.profiles.push(profile[1]);
	}
}

// Audio assets advertise themselves through the AudioArtwork atom inside their card.
const audio = await visit('#/discover', () =>
	[...document.querySelectorAll('.audio-artwork')]
		.map((node) => node.closest('a[href]')?.getAttribute('href') ?? '')
		.filter(Boolean)
);
for (const href of audio) {
	const asset = href.match(/#\/asset\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]{10,})$/);
	if (asset) found.audioAssets.push(`${asset[1]}/${asset[2]}`);
}

// Collection pages are the densest source of unique asset ids.
const uniqueCollections = [...new Set(found.collections)];
for (const collectionId of uniqueCollections.slice(0, 3)) {
	const hrefs = await visit(`#/collection/${collectionId}`, hrefCollector);
	for (const href of hrefs) {
		const asset = href.match(/#\/asset\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]{10,})$/);
		if (asset) found.assets.push(`${asset[1]}/${asset[2]}`);
		const audioHref = href.match(/#\/profile\/([A-Za-z0-9_-]{43})$/);
		if (audioHref) found.profiles.push(audioHref[1]);
	}
	const collectionAudio = await visit(`#/collection/${collectionId}`, () =>
		[...document.querySelectorAll('.audio-artwork')]
			.map((node) => node.closest('a[href]')?.getAttribute('href') ?? '')
			.filter(Boolean)
	);
	for (const href of collectionAudio) {
		const asset = href.match(/#\/asset\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]{10,})$/);
		if (asset) found.audioAssets.push(`${asset[1]}/${asset[2]}`);
	}
}

const assets = [...new Set(found.assets)];
const ids = {
	discoveredAt: new Date().toISOString(),
	collections: [...new Set(found.collections)],
	assets,
	// Anything outside the `fungible-tokens` pseudo-collection is a unique (non-fungible) asset.
	uniqueAsset: assets.find((asset) => !asset.startsWith('fungible-tokens/')) ?? null,
	profiles: [...new Set(found.profiles)],
	audioAssets: [...new Set(found.audioAssets)],
	// A token the marketplace actually lists. The shipped default below
	// (src/api/collections/adapter.ts FUNGIBLE_TOKEN_ID) renders "Asset not found" against live
	// data, so it is only a last-resort fallback.
	fungibleAsset: assets.find((asset) => asset.startsWith('fungible-tokens/')) ?? null,
	fungibleCollectionId: 'fungible-tokens',
	fungibleAssetId: 'IyFfmbTu8P4rv0KyrA0Q-QtfEnYntMj4RkRiBVip9KA',
};

fs.writeFileSync(path.join(DATA_ROOT, 'ids.json'), JSON.stringify(ids, null, 2));
console.log(JSON.stringify(ids, null, 2));

await browser.close();
await server.close();
