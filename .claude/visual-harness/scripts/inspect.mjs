// Ad-hoc: load routes and print what they render. Useful when choosing scenario ids/selectors.
import { createPage, launchBrowser } from './lib/browser.mjs';
import { drivePage } from './lib/drive.mjs';
import { resolveDist } from './lib/env.mjs';
import { createNetCache, loadPool } from './lib/netcache.mjs';
import { startServer } from './lib/server.mjs';

const routes = process.argv.slice(2);
const verbose = process.env.VR_VERBOSE === '1';
const server = await startServer(resolveDist(process.env.VR_DIST ?? 'styles-base'));
const browser = await launchBrowser();
const pool = loadPool();

for (const route of routes) {
	const cache = createNetCache({
		mode: 'record',
		scenario: `__inspect-${route.replace(/[^a-z0-9]+/gi, '-')}`,
		appOrigin: server.origin,
		pool,
		log: verbose ? (message) => console.log(message) : () => {},
	});
	const { context, page } = await createPage(browser, { viewport: { width: 1440, height: 900 } });
	await cache.attach(context);
	const notes = await drivePage(page, {
		scenario: { route },
		origin: server.origin,
		cache,
		mode: 'record',
		budgetMs: 420_000,
	});
	console.log(`\n########## ${route}`);
	console.log(
		`stats recorded=${cache.stats.recorded} reused=${cache.stats.reused} served=${
			cache.stats.served
		} notes=${notes.join('|')}`
	);
	console.log('--- text (1200) ---');
	console.log((await page.evaluate(() => document.body.innerText)).slice(0, 1200));
	console.log('--- app hrefs ---');
	console.log(
		JSON.stringify(
			await page.evaluate(() =>
				[
					...new Set(
						[...document.querySelectorAll('a[href]')]
							.map((anchor) => anchor.getAttribute('href') ?? '')
							.filter((href) => href.includes('#/'))
					),
				].slice(0, 40)
			)
		)
	);
	console.log('--- notable classes ---');
	console.log(
		JSON.stringify(
			await page.evaluate(() => {
				const counts = {};
				for (const element of document.querySelectorAll('[class]')) {
					for (const name of element.classList) counts[name] = (counts[name] ?? 0) + 1;
				}
				return Object.entries(counts)
					.filter(([name]) => /card|grid|asset|token|audio|tab|panel|page|shell/i.test(name))
					.sort((a, b) => b[1] - a[1])
					.slice(0, 28);
			})
		)
	);
	cache.save();
	await context.close();
}

await browser.close();
await server.close();
