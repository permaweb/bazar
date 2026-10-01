import { createPage, launchBrowser } from './lib/browser.mjs';
import { drivePage } from './lib/drive.mjs';
import { resolveDist } from './lib/env.mjs';
import { createNetCache } from './lib/netcache.mjs';
import { buildScenarios } from './lib/scenarios.mjs';
import { startServer } from './lib/server.mjs';

const name = process.argv[2] || 'activity-desktop';
const ref = process.argv[3] || 'styles-after';
const scenario = buildScenarios().find((s) => s.name === name);
const server = await startServer(resolveDist(ref));
const browser = await launchBrowser();
const cache = createNetCache({ mode: 'replay', scenario: name, appOrigin: server.origin });
const { context, page } = await createPage(browser, scenario);
await cache.attach(context);
await drivePage(page, { scenario, origin: server.origin, cache, mode: 'replay' });

console.log(
	JSON.stringify(
		await page.evaluate(() => {
			const styled = new Set(),
				global = new Set(),
				standalone = new Set();
			const harvest = (rules, sink, isStyled) => {
				for (const r of rules) {
					if (r.selectorText) {
						for (const m of r.selectorText.match(/\.(-?[_a-zA-Z][\w-]*)/g) || []) sink.add(m.slice(1));
						if (isStyled)
							for (const sel of r.selectorText.split(',')) {
								const t = sel.trim();
								if (/^\.[-_a-zA-Z][\w-]*$/.test(t)) standalone.add(t.slice(1));
							}
					}
					if (r.cssRules) harvest(r.cssRules, sink, isStyled);
				}
			};
			for (const sh of document.styleSheets) {
				let rules;
				try {
					rules = sh.cssRules;
				} catch {
					continue;
				}
				const o = sh.ownerNode;
				const isStyled = Boolean(o && o.tagName === 'STYLE' && o.hasAttribute('data-styled'));
				harvest(rules, isStyled ? styled : global, isStyled);
			}
			const allEls = [...document.body.querySelectorAll('*')];
			const scEls = allEls.filter((e) => [...e.classList].some((c) => c.startsWith('sc-')));
			const ul =
				document.querySelector('.fungible-asset-page') ||
				document.querySelector('.create-page') ||
				document.querySelector('.atomic-asset-page');
			const sample = allEls
				.slice(0, 400)
				.filter((e) => e.classList.length > 1)
				.slice(0, 6)
				.map((e) => ({ tag: e.tagName.toLowerCase(), classes: [...e.classList] }));
			const describe = (c) => ({
				c,
				styled: styled.has(c),
				global: global.has(c),
				standalone: standalone.has(c),
			});
			return {
				totalStyledClasses: styled.size,
				totalGlobalClasses: global.size,
				totalStandalone: standalone.size,
				elementsWithScClass: scEls.length,
				dataStyledTags: document.querySelectorAll('style[data-styled]').length,
				activityList: ul ? { classes: [...ul.classList], detail: [...ul.classList].map(describe) } : null,
				sample,
				probeClasses: ['eOkXho', 'dDYRyd', 'ezeRRU', 'kkqpfe'].map((c) => ({
					c,
					styled: styled.has(c),
					global: global.has(c),
					standalone: standalone.has(c),
				})),
				styleTagCount: document.querySelectorAll('style').length,
				ruleCountsPerSheet: [...document.styleSheets].map((sh) => {
					let n = 0;
					try {
						n = sh.cssRules.length;
					} catch {
						n = -1;
					}
					return {
						styled: Boolean(
							sh.ownerNode && sh.ownerNode.tagName === 'STYLE' && sh.ownerNode.hasAttribute('data-styled')
						),
						rules: n,
					};
				}),
				targetRaw: (() => {
					const el = document.querySelector('.fungible-asset-page,.create-page,.atomic-asset-page');
					return el ? { tag: el.tagName, cls: el.className, list: [...el.classList] } : null;
				})(),
				hashDetail: (() => {
					const el = document.querySelector('.fungible-asset-page,.create-page,.atomic-asset-page');
					if (!el) return null;
					return [...el.classList].map((c) => ({
						c,
						styled: styled.has(c),
						global: global.has(c),
						standalone: standalone.has(c),
					}));
				})(),
				positional: (() => {
					const cand = new Set();
					const odd = [];
					for (const e of allEls) {
						const cl = [...e.classList];
						for (let i = 0; i < cl.length; i++) {
							if (!cl[i].startsWith('sc-')) continue;
							if (i + 1 < cl.length) cand.add(cl[i + 1]);
							else odd.push(cl.join(' '));
							if (i + 1 < cl.length && cl[i + 1].startsWith('sc-'))
								odd.push('ADJACENT_SC: ' + cl.join(' '));
						}
					}
					const shape = (c) => /^[A-Za-z][A-Za-z0-9]{3,11}$/.test(c);
					const finalSet = [...new Set([...cand, ...standalone])]
						.filter((c) => shape(c) && !global.has(c))
						.sort();
					const authoredLooking = finalSet.filter(
						(c) =>
							allEls.some(
								(e) =>
									e.classList.contains(c) &&
									![...e.classList].some((x, i, a) => x.startsWith('sc-') && a[i + 1] === c)
							) && !standalone.has(c)
					);
					return {
						candidates: [...cand].sort(),
						oddities: odd.slice(0, 5),
						finalSet,
						finalCount: finalSet.length,
						authoredLooking,
					};
				})(),
				allStandalone: [...standalone].sort(),
				shapeMismatch: [...standalone].filter((c) => !/^[A-Za-z][A-Za-z0-9]{3,11}$/.test(c)),
				standaloneAlsoGlobal: [...standalone].filter((c) => global.has(c)),
				hashClassesOnScElements: [
					...new Set(scEls.flatMap((e) => [...e.classList].filter((c) => standalone.has(c)))),
				].sort(),
				scElementsMissingAHash: scEls.filter((e) => ![...e.classList].some((c) => standalone.has(c))).length,
			};
		}, null),
		null,
		1
	)
);
await browser.close();
await server.close();
