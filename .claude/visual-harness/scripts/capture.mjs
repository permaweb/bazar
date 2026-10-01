// Capture every scenario against one build.
//
//   node scripts/capture.mjs <ref|dist> <name> [--record|--topup] [--only <substring>]
//
// --record fetches from the live gateways and writes recordings/<scenario>.json, driving the page
//   patiently so the rate limiter can be waited out.
// --topup also records, but drives the page with replay timing, so it fills in exactly the requests
//   a replay needs. Repeat until a plain capture reports 0 unmatched.
// With neither flag every scenario replays its recording, and an unmatched request is aborted and
// counted.
import fs from 'node:fs';
import path from 'node:path';

import { createPage, launchBrowser } from './lib/browser.mjs';
import { drivePage } from './lib/drive.mjs';
import { DIRS, ensureDirs, resolveDist } from './lib/env.mjs';
import { createNetCache, loadPool } from './lib/netcache.mjs';
import { buildScenarios } from './lib/scenarios.mjs';
import { startServer } from './lib/server.mjs';
import { collectSnapshot } from './lib/snapshot.mjs';

const argv = process.argv.slice(2);
const target = argv[0];
const captureName = argv[1];
const record = argv.includes('--record');
// Top-up: record any request the replay is missing, but drive the page with replay timing.
// The app batches GraphQL ids by what has arrived so far, so a slow recording pass and a fast
// replay pass form different batches and therefore different request bodies. Topping up under
// replay timing closes that gap; repeat until a pure replay reports 0 unmatched.
const topup = argv.includes('--topup');
const cacheMode = record || topup ? 'record' : 'replay';
const driveMode = record ? 'record' : 'replay';
const onlyIndex = argv.indexOf('--only');
const only = onlyIndex === -1 ? null : argv[onlyIndex + 1];

if (!target || !captureName) {
	console.error('usage: capture.mjs <ref|dist> <name> [--record|--topup] [--only <substring>]');
	process.exit(2);
}

ensureDirs();
const dist = resolveDist(target);
const scenarios = buildScenarios().filter((scenario) => !only || scenario.name.includes(only));
const outDir = path.join(DIRS.captures, captureName);
fs.mkdirSync(outDir, { recursive: true });

const pool = cacheMode === 'record' ? loadPool() : new Map();
const server = await startServer(dist);
const browser = await launchBrowser();
const started = Date.now();
const manifest = { name: captureName, target, dist, mode: cacheMode, driveMode, scenarios: [] };

console.log(`${record ? 'recording' : topup ? 'topping up' : 'capturing'} ${scenarios.length} scenarios from ${dist}`);

for (const [index, scenario] of scenarios.entries()) {
	const scenarioStart = Date.now();
	const scenarioDir = path.join(outDir, scenario.name);
	fs.mkdirSync(scenarioDir, { recursive: true });
	const cache = createNetCache({
		mode: cacheMode,
		scenario: scenario.name,
		appOrigin: server.origin,
		pool,
		log: process.env.VR_VERBOSE === '1' ? (message) => console.log(message) : () => {},
	});
	const { context, page } = await createPage(browser, scenario);
	await cache.attach(context);

	let notes = [];
	let failure = null;
	try {
		notes = await drivePage(page, {
			scenario,
			origin: server.origin,
			cache,
			mode: driveMode,
		});
		const snapshot = JSON.parse(await page.evaluate(collectSnapshot, { appOrigin: server.origin }));
		fs.writeFileSync(path.join(scenarioDir, 'elements.json'), JSON.stringify(snapshot));
		await page.screenshot({
			path: path.join(scenarioDir, 'screenshot.png'),
			fullPage: true,
			caret: 'hide',
			animations: 'disabled',
			scale: 'css',
			// A scenario may mask a region whose pixels cannot be made deterministic (e.g. a
			// requestAnimationFrame-driven chart canvas). The element snapshot still covers its
			// layout and computed styles, so only the painted pixels are excluded.
			...(scenario.mask?.length
				? { mask: scenario.mask.map((selector) => page.locator(selector)), maskColor: '#000000' }
				: {}),
		});
	} catch (error) {
		failure = error.message.slice(0, 400);
		console.log(`  !! ${scenario.name}: ${failure}`);
	}

	if (cacheMode === 'record') cache.save();
	const entry = {
		name: scenario.name,
		route: scenario.route,
		viewport: scenario.viewport,
		theme: scenario.theme ?? 'light',
		wallet: Boolean(scenario.wallet),
		steps: (scenario.steps ?? []).map((step) => step.click ?? step.waitFor ?? 'wait'),
		mask: scenario.mask ?? [],
		notes,
		failure,
		network: {
			served: cache.stats.served,
			recorded: cache.stats.recorded,
			reused: cache.stats.reused,
			degraded: cache.stats.degraded,
			synthesized: cache.stats.synthesized,
			blocked: cache.stats.blocked,
			appOrigin: cache.stats.passthrough,
			unmatched: cache.stats.unmatched,
			unmatchedKeys: cache.stats.unmatchedKeys,
		},
		durationMs: Date.now() - scenarioStart,
	};
	fs.writeFileSync(path.join(scenarioDir, 'meta.json'), JSON.stringify(entry, null, 2));
	manifest.scenarios.push(entry);
	console.log(
		`  [${index + 1}/${scenarios.length}] ${scenario.name} ` +
			`served=${cache.stats.served} recorded=${cache.stats.recorded} ` +
			`degraded=${cache.stats.degraded} synth=${cache.stats.synthesized} unmatched=${cache.stats.unmatched} ` +
			`${Math.round(entry.durationMs / 1000)}s${notes.length ? ` notes=${notes.join(',')}` : ''}`
	);
	await context.close();
}

manifest.durationMs = Date.now() - started;
manifest.capturedAt = new Date().toISOString();
fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

const total = (field) => manifest.scenarios.reduce((sum, entry) => sum + entry.network[field], 0);
const unmatched = total('unmatched');
console.log(
	`\ndone in ${Math.round(manifest.durationMs / 1000)}s — unmatched ${unmatched}, ` +
		`synthesized ${total('synthesized')}, degraded ${total('degraded')}`
);
if (unmatched) {
	console.log('scenarios with unmatched requests:');
	for (const entry of manifest.scenarios.filter((item) => item.network.unmatched)) {
		console.log(`  ${entry.name}: ${entry.network.unmatched}`);
		for (const key of entry.network.unmatchedKeys.slice(0, 5)) console.log(`      ${key.slice(0, 150)}`);
	}
}

await browser.close();
await server.close();
