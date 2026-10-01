// Compare two captures.
//
//   node scripts/compare.mjs <captureA> <captureB> [--box-epsilon 0.5] [--pixel-tolerance 2]
//
// Writes reports/<a>__<b>/report.md, report.json and diffs/<scenario>.png.
import fs from 'node:fs';
import path from 'node:path';

import { launchBrowser } from './lib/browser.mjs';
import { DIRS, ensureDirs } from './lib/env.mjs';
import { startFileServer } from './lib/server.mjs';
import { expandSnapshot } from './lib/snapshot.mjs';

const argv = process.argv.slice(2);
const [nameA, nameB] = argv;
const numeric = (flag, fallback) => {
	const index = argv.indexOf(flag);
	return index === -1 ? fallback : Number(argv[index + 1]);
};
const BOX_EPSILON = numeric('--box-epsilon', 0.5);
const PIXEL_TOLERANCE = numeric('--pixel-tolerance', 2);

if (!nameA || !nameB) {
	console.error('usage: compare.mjs <captureA> <captureB>');
	process.exit(2);
}
ensureDirs();

const dirA = path.join(DIRS.captures, nameA);
const dirB = path.join(DIRS.captures, nameB);
for (const dir of [dirA, dirB]) {
	if (!fs.existsSync(path.join(dir, 'manifest.json'))) throw new Error(`missing capture: ${dir}`);
}
const manifestA = JSON.parse(fs.readFileSync(path.join(dirA, 'manifest.json'), 'utf8'));
const manifestB = JSON.parse(fs.readFileSync(path.join(dirB, 'manifest.json'), 'utf8'));

const reportDir = path.join(DIRS.reports, `${nameA}__${nameB}`);
fs.mkdirSync(path.join(reportDir, 'diffs'), { recursive: true });

const namesA = new Set(manifestA.scenarios.map((entry) => entry.name));
const namesB = new Set(manifestB.scenarios.map((entry) => entry.name));
const shared = manifestA.scenarios.map((entry) => entry.name).filter((name) => namesB.has(name));

// ---- collapsed difference buckets ----------------------------------------------------------
const styleGroups = new Map();
const boxGroups = new Map();
const textGroups = new Map();
const presenceGroups = new Map();

// Same buckets again, but kept per scenario, so the report can show both the collapsed global view
// and a per-scenario breakdown with selector / property / before / after.
const perScenario = new Map();
function scenarioBucket(scenario, kind) {
	let buckets = perScenario.get(scenario);
	if (!buckets) {
		buckets = { style: new Map(), box: new Map(), text: new Map(), presence: new Map() };
		perScenario.set(scenario, buckets);
	}
	return buckets[kind];
}

function bump(map, key, scenario, sampleKey, extra = {}) {
	let group = map.get(key);
	if (!group) {
		group = { key, count: 0, scenarios: new Set(), samples: [], ...extra };
		map.set(key, group);
	}
	group.count += 1;
	group.scenarios.add(scenario);
	if (group.samples.length < 4) group.samples.push(sampleKey);
	return group;
}

// Legacy flexbox aliases. styled-components v5 runs stylis, which auto-prefixes `align-items` and
// `justify-content` into these; the plain global stylesheet was never autoprefixed. They only affect
// the obsolete `display: -webkit-box` layout, so a change here paints nothing — but it is still a
// real computed-value change, so it is reported, just separated from the findings that matter.
const LEGACY_PREFIX_PROPERTIES = new Set([
	'-webkit-box-align',
	'-webkit-box-pack',
	'-webkit-box-orient',
	'-webkit-box-direction',
	'-webkit-box-flex',
	'-webkit-box-ordinal-group',
	'-webkit-box-lines',
]);

function classifyProperty(property) {
	const bare = property.replace(/^::(before|after) /, '');
	if (bare.startsWith('--')) return 'custom-property';
	if (LEGACY_PREFIX_PROPERTIES.has(bare)) return 'legacy-prefix';
	return 'substantive';
}

function bumpBoth(map, kind, key, scenario, sampleKey, extra = {}) {
	bump(map, key, scenario, sampleKey, extra);
	bump(scenarioBucket(scenario, kind), key, scenario, sampleKey, extra);
}

const browser = await launchBrowser();
const fileServer = await startFileServer(DIRS.captures);
const diffPage = await (await browser.newContext({ viewport: { width: 400, height: 300 } })).newPage();
await diffPage.goto(`${fileServer.origin}/__blank.html`);

async function pixelDiff(scenario) {
	const relA = `${nameA}/${scenario}/screenshot.png`;
	const relB = `${nameB}/${scenario}/screenshot.png`;
	if (!fs.existsSync(path.join(DIRS.captures, relA)) || !fs.existsSync(path.join(DIRS.captures, relB))) {
		return { error: 'missing screenshot' };
	}
	return diffPage.evaluate(
		async ([urlA, urlB, tolerance]) => {
			const load = (src) =>
				new Promise((resolve, reject) => {
					const image = new Image();
					image.onload = () => resolve(image);
					image.onerror = () => reject(new Error(`load failed: ${src}`));
					image.src = src;
				});
			const [imageA, imageB] = await Promise.all([load(urlA), load(urlB)]);
			const width = Math.max(imageA.width, imageB.width);
			const height = Math.max(imageA.height, imageB.height);
			const read = (image) => {
				const canvas = document.createElement('canvas');
				canvas.width = width;
				canvas.height = height;
				const context = canvas.getContext('2d', { willReadFrequently: true });
				context.clearRect(0, 0, width, height);
				context.drawImage(image, 0, 0);
				return context.getImageData(0, 0, width, height).data;
			};
			const dataA = read(imageA);
			const dataB = read(imageB);
			const out = document.createElement('canvas');
			out.width = width;
			out.height = height;
			const outContext = out.getContext('2d');
			const output = outContext.createImageData(width, height);
			let changed = 0;
			let maxDelta = 0;
			for (let i = 0; i < dataA.length; i += 4) {
				const delta = Math.max(
					Math.abs(dataA[i] - dataB[i]),
					Math.abs(dataA[i + 1] - dataB[i + 1]),
					Math.abs(dataA[i + 2] - dataB[i + 2]),
					Math.abs(dataA[i + 3] - dataB[i + 3])
				);
				if (delta > maxDelta) maxDelta = delta;
				if (delta > tolerance) {
					changed += 1;
					output.data[i] = 255;
					output.data[i + 1] = 0;
					output.data[i + 2] = 255;
					output.data[i + 3] = 255;
				} else {
					const grey = (dataA[i] * 0.3 + dataA[i + 1] * 0.59 + dataA[i + 2] * 0.11) * 0.25 + 191;
					output.data[i] = grey;
					output.data[i + 1] = grey;
					output.data[i + 2] = grey;
					output.data[i + 3] = 255;
				}
			}
			outContext.putImageData(output, 0, 0);
			return {
				width,
				height,
				sizeA: [imageA.width, imageA.height],
				sizeB: [imageB.width, imageB.height],
				changedPixels: changed,
				totalPixels: width * height,
				maxChannelDelta: maxDelta,
				diffPng: changed ? out.toDataURL('image/png') : null,
			};
		},
		[`${fileServer.origin}/${relA}`, `${fileServer.origin}/${relB}`, PIXEL_TOLERANCE]
	);
}

const scenarioReports = [];

for (const scenario of shared) {
	const fileA = path.join(dirA, scenario, 'elements.json');
	const fileB = path.join(dirB, scenario, 'elements.json');
	const metaA = manifestA.scenarios.find((entry) => entry.name === scenario);
	const metaB = manifestB.scenarios.find((entry) => entry.name === scenario);
	if (!fs.existsSync(fileA) || !fs.existsSync(fileB)) {
		scenarioReports.push({ scenario, error: 'missing snapshot', metaA, metaB });
		continue;
	}
	const snapA = JSON.parse(fs.readFileSync(fileA, 'utf8'));
	const snapB = JSON.parse(fs.readFileSync(fileB, 'utf8'));
	const a = expandSnapshot(snapA);
	const b = expandSnapshot(snapB);
	// Both sides run the same pinned Chromium, so the standard property list is identical — but the
	// list also carries the CSS custom properties defined on :root, and a refactor can add or drop
	// one. Compare the UNION, or a variable that exists on only one side is silently invisible.
	const propertySetDiffers = a.properties.join(',') !== b.properties.join(',');
	const propertiesOnlyInA = a.properties.filter((name) => !b.properties.includes(name));
	const propertiesOnlyInB = b.properties.filter((name) => !a.properties.includes(name));
	const allProperties = [...new Set([...a.properties, ...b.properties])].sort();
	const show = (value) => (value === undefined ? '<not defined>' : value);

	const missing = [];
	const added = [];
	for (const key of a.byKey.keys()) if (!b.byKey.has(key)) missing.push(key);
	for (const key of b.byKey.keys()) if (!a.byKey.has(key)) added.push(key);

	let boxDiffs = 0;
	let textDiffs = 0;
	let styleDiffs = 0;
	const styleCache = new Map();
	const styleOf = (expanded, ref, side) => {
		const cacheKey = `${side}:${ref}`;
		let value = styleCache.get(cacheKey);
		if (!value) {
			value = expanded.styleFor(ref);
			styleCache.set(cacheKey, value);
		}
		return value;
	};
	// A styleRef is an index into its OWN snapshot's deduplicated style table, so the two sides'
	// indices mean nothing to each other — comparing them would both miss real differences and
	// invent fake ones. Compare a signature built over the union of properties instead. It is still
	// cheap: there are only a few hundred distinct style vectors per scenario.
	const signatureCache = new Map();
	const signatureOf = (expanded, ref, side) => {
		const cacheKey = `${side}:${ref}`;
		let signature = signatureCache.get(cacheKey);
		if (signature === undefined) {
			const style = styleOf(expanded, ref, side);
			signature = allProperties.map((property) => style[property] ?? '\u0000').join('\u0001');
			signatureCache.set(cacheKey, signature);
		}
		return signature;
	};

	for (const [key, left] of a.byKey) {
		const right = b.byKey.get(key);
		if (!right) continue;

		const deltas = left.box.map((value, index) => Math.round((right.box[index] - value) * 100) / 100);
		if (deltas.some((delta) => Math.abs(delta) > BOX_EPSILON)) {
			boxDiffs += 1;
			bumpBoth(
				boxGroups,
				'box',
				`dx=${deltas[0]} dy=${deltas[1]} dw=${deltas[2]} dh=${deltas[3]}`,
				scenario,
				key
			);
		}
		if (left.text !== right.text) {
			textDiffs += 1;
			bumpBoth(textGroups, 'text', `"${left.text.slice(0, 80)}" -> "${right.text.slice(0, 80)}"`, scenario, key);
		}
		if (signatureOf(a, left.styleRef, 'a') !== signatureOf(b, right.styleRef, 'b')) {
			const styleA = styleOf(a, left.styleRef, 'a');
			const styleB = styleOf(b, right.styleRef, 'b');
			for (const property of allProperties) {
				if (styleA[property] !== styleB[property]) {
					styleDiffs += 1;
					bumpBoth(
						styleGroups,
						'style',
						`${property}: ${show(styleA[property])} -> ${show(styleB[property])}`,
						scenario,
						key,
						{ property, category: classifyProperty(property) }
					);
				}
			}
		}
		for (const [refName, label] of [
			['beforeRef', '::before'],
			['afterRef', '::after'],
		]) {
			if (left[refName] === undefined && right[refName] === undefined) continue;
			if (left[refName] === undefined || right[refName] === undefined) {
				styleDiffs += 1;
				bumpBoth(
					styleGroups,
					'style',
					`${label}: ${left[refName] === undefined ? 'absent' : 'present'} -> ${
						right[refName] === undefined ? 'absent' : 'present'
					}`,
					scenario,
					key,
					{ property: label, category: 'substantive' }
				);
				continue;
			}
			if (signatureOf(a, left[refName], 'a') === signatureOf(b, right[refName], 'b')) continue;
			const styleA = styleOf(a, left[refName], 'a');
			const styleB = styleOf(b, right[refName], 'b');
			for (const property of allProperties) {
				if (styleA[property] !== styleB[property]) {
					styleDiffs += 1;
					bumpBoth(
						styleGroups,
						'style',
						`${label} ${property}: ${show(styleA[property])} -> ${show(styleB[property])}`,
						scenario,
						key,
						{ property: `${label} ${property}`, category: classifyProperty(`${label} ${property}`) }
					);
				}
			}
		}
	}

	for (const key of missing) bumpBoth(presenceGroups, 'presence', `missing in ${nameB}`, scenario, key);
	for (const key of added) bumpBoth(presenceGroups, 'presence', `added in ${nameB}`, scenario, key);

	const pixels = await pixelDiff(scenario);
	if (pixels.diffPng) {
		fs.writeFileSync(
			path.join(reportDir, 'diffs', `${scenario}.png`),
			Buffer.from(pixels.diffPng.split(',')[1], 'base64')
		);
		delete pixels.diffPng;
	}

	scenarioReports.push({
		scenario,
		elementsA: a.byKey.size,
		elementsB: b.byKey.size,
		duplicateKeysA: a.duplicates.length,
		duplicateKeysB: b.duplicates.length,
		propertySetDiffers,
		propertiesOnlyInA,
		propertiesOnlyInB,
		generatedClassesA: snapA.meta?.generatedClasses?.length ?? 0,
		generatedClassesB: snapB.meta?.generatedClasses?.length ?? 0,
		missing: missing.length,
		added: added.length,
		boxDiffs,
		styleDiffs,
		textDiffs,
		pixels,
		unmatchedA: metaA?.network?.unmatched ?? 0,
		unmatchedB: metaB?.network?.unmatched ?? 0,
		notesA: metaA?.notes ?? [],
		notesB: metaB?.notes ?? [],
		failureA: metaA?.failure ?? null,
		failureB: metaB?.failure ?? null,
		missingSample: missing.slice(0, 6),
		addedSample: added.slice(0, 6),
	});
	const clean = !missing.length && !added.length && !boxDiffs && !styleDiffs && !textDiffs && !pixels.changedPixels;
	console.log(
		`  ${clean ? 'OK  ' : 'DIFF'} ${scenario} — miss ${missing.length} add ${
			added.length
		} box ${boxDiffs} style ${styleDiffs} text ${textDiffs} px ${pixels.changedPixels ?? '?'}`
	);
}

await browser.close();
await fileServer.close();

// ---- render ----------------------------------------------------------------------------------
const totals = scenarioReports.reduce(
	(sum, entry) => ({
		missing: sum.missing + (entry.missing ?? 0),
		added: sum.added + (entry.added ?? 0),
		boxDiffs: sum.boxDiffs + (entry.boxDiffs ?? 0),
		styleDiffs: sum.styleDiffs + (entry.styleDiffs ?? 0),
		textDiffs: sum.textDiffs + (entry.textDiffs ?? 0),
		changedPixels: sum.changedPixels + (entry.pixels?.changedPixels ?? 0),
		unmatched: sum.unmatched + (entry.unmatchedA ?? 0) + (entry.unmatchedB ?? 0),
	}),
	{ missing: 0, added: 0, boxDiffs: 0, styleDiffs: 0, textDiffs: 0, changedPixels: 0, unmatched: 0 }
);
const cleanRun = Object.values(totals).every((value) => value === 0);

const serialiseGroups = (map) =>
	[...map.values()]
		.map((group) => ({
			key: group.key,
			category: group.category,
			property: group.property,
			count: group.count,
			scenarios: [...group.scenarios].sort(),
			samples: group.samples,
		}))
		.sort((left, right) => right.count - left.count);

const json = {
	a: nameA,
	b: nameB,
	comparedAt: new Date().toISOString(),
	boxEpsilon: BOX_EPSILON,
	pixelTolerance: PIXEL_TOLERANCE,
	clean: cleanRun,
	totals,
	onlyInA: [...namesA].filter((name) => !namesB.has(name)),
	onlyInB: [...namesB].filter((name) => !namesA.has(name)),
	scenarios: scenarioReports,
	groups: {
		style: serialiseGroups(styleGroups),
		box: serialiseGroups(boxGroups),
		text: serialiseGroups(textGroups),
		presence: serialiseGroups(presenceGroups),
	},
	// Same buckets per scenario, so a consumer can fix one surface at a time.
	byScenario: Object.fromEntries(
		[...perScenario.entries()].map(([scenario, buckets]) => [
			scenario,
			{
				style: serialiseGroups(buckets.style),
				box: serialiseGroups(buckets.box),
				text: serialiseGroups(buckets.text),
				presence: serialiseGroups(buckets.presence),
			},
		])
	),
};
fs.writeFileSync(path.join(reportDir, 'report.json'), JSON.stringify(json, null, 2));

const lines = [];
lines.push(`# Visual regression: \`${nameA}\` vs \`${nameB}\``);
lines.push('');
lines.push(`Compared ${shared.length} scenarios at ${json.comparedAt}.`);
lines.push('');
lines.push(cleanRun ? '**RESULT: CLEAN — no differences.**' : '**RESULT: DIFFERENCES FOUND.**');
lines.push('');
lines.push(
	`Totals — missing ${totals.missing}, added ${totals.added}, box ${totals.boxDiffs}, ` +
		`style ${totals.styleDiffs}, text ${totals.textDiffs}, changed pixels ${totals.changedPixels}, ` +
		`unmatched network ${totals.unmatched}.`
);
lines.push('');
if (json.onlyInA.length || json.onlyInB.length) {
	lines.push(`Scenarios only in \`${nameA}\`: ${json.onlyInA.join(', ') || 'none'}`);
	lines.push(`Scenarios only in \`${nameB}\`: ${json.onlyInB.join(', ') || 'none'}`);
	lines.push('');
}

lines.push('## Per scenario');
lines.push('');
lines.push('| scenario | elements | missing | added | box | style | text | changed px | px % | unmatched |');
lines.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
for (const entry of scenarioReports) {
	if (entry.error) {
		lines.push(`| ${entry.scenario} | — | — | — | — | — | — | — | — | ${entry.error} |`);
		continue;
	}
	const percent = entry.pixels?.totalPixels
		? ((entry.pixels.changedPixels / entry.pixels.totalPixels) * 100).toFixed(4)
		: '—';
	lines.push(
		`| ${entry.scenario} | ${entry.elementsA}/${entry.elementsB} | ${entry.missing} | ${entry.added} | ` +
			`${entry.boxDiffs} | ${entry.styleDiffs} | ${entry.textDiffs} | ${
				entry.pixels?.changedPixels ?? '—'
			} | ${percent} | ` +
			`${entry.unmatchedA + entry.unmatchedB} |`
	);
}
lines.push('');

const section = (title, groups, limit = 40) => {
	if (!groups.length) return;
	lines.push(`## ${title} (${groups.length} distinct)`);
	lines.push('');
	for (const group of groups.slice(0, limit)) {
		lines.push(`- **${group.key}**`);
		lines.push(
			`  - ${group.count} element(s) across ${group.scenarios.length} scenario(s): ${group.scenarios
				.slice(0, 8)
				.join(', ')}${group.scenarios.length > 8 ? ', …' : ''}`
		);
		lines.push(`  - e.g. \`${group.samples[0]}\``);
	}
	if (groups.length > limit) lines.push(`- …and ${groups.length - limit} more (see report.json)`);
	lines.push('');
};

// ---- per-scenario detail --------------------------------------------------------------------
const detailed = scenarioReports.filter(
	(entry) =>
		entry.missing ||
		entry.added ||
		entry.boxDiffs ||
		entry.styleDiffs ||
		entry.textDiffs ||
		entry.pixels?.changedPixels
);
if (detailed.length) {
	lines.push('## Detail by scenario');
	lines.push('');
	lines.push(`Each bullet collapses identical differences within that scenario. \`${nameA}\` -> \`${nameB}\`.`);
	lines.push('');
	for (const entry of detailed) {
		const buckets = perScenario.get(entry.scenario) ?? {
			style: new Map(),
			box: new Map(),
			text: new Map(),
			presence: new Map(),
		};
		lines.push(`### ${entry.scenario}`);
		lines.push('');
		lines.push(
			`route \`${manifestA.scenarios.find((item) => item.name === entry.scenario)?.route ?? '?'}\` · ` +
				`elements ${entry.elementsA} -> ${entry.elementsB} · ` +
				`changed pixels ${entry.pixels?.changedPixels ?? '—'}` +
				(entry.pixels?.totalPixels
					? ` (${((entry.pixels.changedPixels / entry.pixels.totalPixels) * 100).toFixed(4)}%)`
					: '') +
				(entry.pixels?.sizeA && entry.pixels?.sizeB
					? ` · page ${entry.pixels.sizeA.join('x')} -> ${entry.pixels.sizeB.join('x')}`
					: '')
		);
		lines.push('');
		const bucketSection = (title, map, limit) => {
			const groups = [...map.values()].sort((left, right) => right.count - left.count);
			if (!groups.length) return;
			lines.push(`**${title}** (${groups.length} distinct)`);
			lines.push('');
			for (const group of groups.slice(0, limit)) {
				lines.push(`- \`${group.key}\` — ${group.count} element(s)`);
				for (const sample of group.samples.slice(0, 2)) lines.push(`  - \`${sample}\``);
			}
			if (groups.length > limit) lines.push(`- …and ${groups.length - limit} more (see report.json)`);
			lines.push('');
		};
		// Substantive findings first; prefixing and custom-property noise after, clearly labelled.
		const styleByCategory = { substantive: new Map(), 'legacy-prefix': new Map(), 'custom-property': new Map() };
		for (const [groupKey, group] of buckets.style) {
			styleByCategory[group.category ?? 'substantive'].set(groupKey, group);
		}
		bucketSection('Computed style', styleByCategory.substantive, 40);
		bucketSection(
			'Computed style — legacy -webkit-box aliases (stylis autoprefixing, paints nothing)',
			styleByCategory['legacy-prefix'],
			15
		);
		bucketSection('Computed style — CSS custom properties', styleByCategory['custom-property'], 15);
		bucketSection('Bounding box', buckets.box, 15);
		bucketSection('Text', buckets.text, 15);
		bucketSection('Element presence', buckets.presence, 10);
	}
}

const diagnostics = scenarioReports.filter(
	(entry) => entry.duplicateKeysA || entry.duplicateKeysB || entry.propertySetDiffers
);
if (diagnostics.length) {
	lines.push('## Snapshot diagnostics');
	lines.push('');
	for (const entry of diagnostics) {
		lines.push(
			`- \`${entry.scenario}\` — duplicate keys ${entry.duplicateKeysA}/${entry.duplicateKeysB}` +
				(entry.propertySetDiffers
					? `, CSS custom properties only in \`${nameA}\`: ${entry.propertiesOnlyInA?.join(', ') || 'none'}` +
					  `; only in \`${nameB}\`: ${entry.propertiesOnlyInB?.join(', ') || 'none'}`
					: '')
		);
	}
	lines.push('');
}
const generated = scenarioReports.filter((entry) => entry.generatedClassesA || entry.generatedClassesB);
if (generated.length) {
	lines.push('## styled-components generated classes excluded from keys');
	lines.push('');
	lines.push('| scenario | in ' + nameA + ' | in ' + nameB + ' |');
	lines.push('|---|---:|---:|');
	for (const entry of generated) {
		lines.push(`| ${entry.scenario} | ${entry.generatedClassesA} | ${entry.generatedClassesB} |`);
	}
	lines.push('');
}

section('Computed style differences', json.groups.style);
section('Bounding box differences', json.groups.box);
section('Text differences', json.groups.text);

if (json.groups.presence.length) {
	lines.push(`## Element presence`);
	lines.push('');
	for (const group of json.groups.presence) {
		lines.push(`- **${group.key}** — ${group.count} element(s) across ${group.scenarios.length} scenario(s)`);
		for (const sample of group.samples) lines.push(`  - \`${sample}\``);
	}
	lines.push('');
}

const noisy = scenarioReports.filter(
	(entry) => entry.notesA?.length || entry.notesB?.length || entry.failureA || entry.failureB
);
if (noisy.length) {
	lines.push('## Capture notes');
	lines.push('');
	const describe = (failure, notes) => failure ?? (notes.length ? notes.join(', ') : 'ok');
	for (const entry of noisy) {
		lines.push(
			`- \`${entry.scenario}\` — ${nameA}: ${describe(entry.failureA, entry.notesA)} | ` +
				`${nameB}: ${describe(entry.failureB, entry.notesB)}`
		);
	}
	lines.push('');
}

lines.push(`Pixel diff images (magenta = changed): \`${path.join(reportDir, 'diffs')}\``);
lines.push('');

fs.writeFileSync(path.join(reportDir, 'report.md'), lines.join('\n'));
console.log(`\n${cleanRun ? 'CLEAN' : 'DIFFERENCES'} — report written to ${path.join(reportDir, 'report.md')}`);
process.exit(cleanRun ? 0 : 1);
