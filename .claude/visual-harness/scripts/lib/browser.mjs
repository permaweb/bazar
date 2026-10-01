// Browser launch plus every determinism control the harness relies on.
import { CHROMIUM, FIXED_TIME, LOCALE, loadPlaywright, TIMEZONE } from './env.mjs';

const LAUNCH_ARGS = [
	'--force-color-profile=srgb',
	'--font-render-hinting=none',
	'--disable-font-subpixel-positioning',
	'--disable-lcd-text',
	'--hide-scrollbars',
	'--disable-background-timer-throttling',
	'--disable-renderer-backgrounding',
	'--disable-backgrounding-occluded-windows',
	'--deterministic-fetch',
	'--disable-features=PaintHolding,BackForwardCache',
];

// Deterministic replacements for the two entropy sources the app can reach.
const SEED_SCRIPT = `(() => {
	let seed = 0x9e3779b9;
	const next = () => {
		seed = (seed + 0x6d2b79f5) >>> 0;
		let t = seed;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
	Math.random = next;
	let uuidCounter = 0;
	const uuid = () => {
		uuidCounter += 1;
		const hex = uuidCounter.toString(16).padStart(12, '0');
		return \`00000000-0000-4000-8000-\${hex}\`;
	};
	try {
		Object.defineProperty(crypto, 'randomUUID', { configurable: true, writable: true, value: uuid });
	} catch {
		crypto.randomUUID = uuid;
	}
	const fillRandom = (array) => {
		const view = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
		for (let i = 0; i < view.length; i += 1) view[i] = Math.floor(next() * 256);
		return array;
	};
	try {
		Object.defineProperty(crypto, 'getRandomValues', { configurable: true, writable: true, value: fillRandom });
	} catch {
		crypto.getRandomValues = fillRandom;
	}
	// Service workers never register; the static server also 404s the script.
	try {
		Object.defineProperty(navigator, 'serviceWorker', { configurable: true, get: () => undefined });
	} catch {}
})();`;

// A minimal read-only wallet. Signing throws, so nothing can ever be submitted.
export function walletScript(address) {
	return `(() => {
		const address = ${JSON.stringify(address)};
		const permissions = ['ACCESS_ADDRESS', 'ACCESS_PUBLIC_KEY', 'SIGN_TRANSACTION'];
		const listeners = new Map();
		window.arweaveWallet = {
			walletName: 'ArConnect',
			connect: async () => undefined,
			disconnect: async () => undefined,
			getActiveAddress: async () => address,
			getPermissions: async () => permissions.slice(),
			getActivePublicKey: async () => 'harness-public-key',
			getArweaveConfig: async () => ({ host: 'arweave.net', port: 443, protocol: 'https' }),
			getWalletNames: async () => ({ [address]: 'harness' }),
			sign: async () => {
				throw new Error('visual-harness: signing is disabled');
			},
			signDataItem: async () => {
				throw new Error('visual-harness: signing is disabled');
			},
			dispatch: async () => {
				throw new Error('visual-harness: signing is disabled');
			},
			addEventListener: (name, handler) => {
				listeners.set(name, handler);
			},
			removeEventListener: (name) => listeners.delete(name),
		};
		window.dispatchEvent(new CustomEvent('arweaveWalletLoaded'));
	})();`;
}

export async function launchBrowser() {
	const { chromium } = await loadPlaywright();
	return chromium.launch({ executablePath: CHROMIUM, headless: true, args: LAUNCH_ARGS });
}

export async function createPage(browser, scenario, { extraInit = [] } = {}) {
	const context = await browser.newContext({
		viewport: scenario.viewport,
		deviceScaleFactor: 1,
		locale: LOCALE,
		timezoneId: TIMEZONE,
		reducedMotion: 'reduce',
		forcedColors: 'none',
		colorScheme: scenario.colorScheme ?? 'light',
		serviceWorkers: 'block',
		isMobile: false,
		hasTouch: false,
		bypassCSP: true,
	});
	await context.addInitScript(SEED_SCRIPT);
	// Theme preference must be in storage before the inline boot script in index.html reads it.
	if (scenario.theme) {
		await context.addInitScript(
			`try {
				localStorage.setItem('preferredTheme', ${JSON.stringify(scenario.theme)});
				localStorage.setItem('isSystemTheme', 'false');
			} catch {}`
		);
	}
	if (scenario.wallet) await context.addInitScript(walletScript(scenario.wallet));
	for (const script of extraInit) await context.addInitScript(script);
	const page = await context.newPage();
	trackActivity(page);
	// Fix wall-clock time while leaving timers running, so the app's deadlines still resolve.
	try {
		await page.clock.setFixedTime(FIXED_TIME);
	} catch {
		await page.clock.install({ time: FIXED_TIME });
	}
	page.setDefaultTimeout(60_000);
	return { context, page };
}

// Playwright's networkidle needs every connection to stop for 500ms. This app keeps a steady
// trickle of AO/gateway reads going, so networkidle routinely burns its whole timeout and tells us
// nothing. Track request activity ourselves and wait for a quiet window instead.
const ACTIVITY = new WeakMap();

function trackActivity(page) {
	const state = { lastEventAt: Date.now(), pending: 0 };
	ACTIVITY.set(page, state);
	page.on('request', () => {
		state.pending += 1;
		state.lastEventAt = Date.now();
	});
	const settleOne = () => {
		state.pending = Math.max(0, state.pending - 1);
		state.lastEventAt = Date.now();
	};
	page.on('requestfinished', settleOne);
	page.on('requestfailed', settleOne);
}

/** Resolve once no request has started or finished for `quietMs`, or after `capMs`. */
async function waitQuiet(page, quietMs, capMs) {
	const state = ACTIVITY.get(page);
	if (!state) {
		await page.waitForTimeout(quietMs);
		return true;
	}
	const deadline = Date.now() + capMs;
	for (;;) {
		const idleFor = Date.now() - state.lastEventAt;
		if (state.pending <= 0 && idleFor >= quietMs) return true;
		if (Date.now() >= deadline) return false;
		await page.waitForTimeout(Math.min(150, Math.max(50, quietMs - idleFor)));
	}
}

/** Freeze every running animation and transition at its start, without touching computed styles. */
export async function parkAnimations(page) {
	await page.evaluate(() => {
		for (const animation of document.getAnimations()) {
			try {
				animation.currentTime = 0;
				animation.pause();
			} catch {
				// A finished or detached animation cannot be parked, and does not need to be.
			}
		}
		for (const media of document.querySelectorAll('video, audio')) {
			try {
				media.pause();
				media.currentTime = 0;
			} catch {}
		}
	});
}

/** Wait until the page has stopped changing: no loaders, network idle, fonts ready, then settle. */
// This app never reaches a truly idle network (it re-probes AO processes on a ~30s TTL), so the
// quiet waits are capped rather than relied on; the real readiness signals are the loader elements
// detaching plus fonts and images being ready. The caps must stay identical across the baseline,
// the calibration and every compared capture — change them only before re-taking the baseline.
export async function settle(
	page,
	{ settleMs = 1200, idleTimeout = Number(process.env.VR_QUIET_CAP_MS ?? 20_000), loaderTimeout = 15_000 } = {}
) {
	const notes = [];
	if (!(await waitQuiet(page, 900, idleTimeout))) notes.push('network-never-quiet');
	for (const selector of ['.loading', '.asset-detail-loading-shell', '.layout-placeholder']) {
		// Only wait on a loader that is actually on the page; an absent one must not cost a timeout.
		const present = await page
			.locator(selector)
			.count()
			.catch(() => 0);
		if (!present) continue;
		try {
			await page.waitForSelector(selector, { state: 'detached', timeout: loaderTimeout });
		} catch {
			notes.push(`still-present:${selector}`);
		}
	}
	try {
		await page.evaluate(() => document.fonts.ready);
	} catch {
		notes.push('fonts-not-ready');
	}
	// A pending image decode would otherwise land between the two captures of a scenario.
	try {
		await page.evaluate(
			() =>
				new Promise((resolve) => {
					const pending = [...document.images].filter((image) => !image.complete);
					if (!pending.length) return resolve();
					let left = pending.length;
					const done = () => {
						left -= 1;
						if (left <= 0) resolve();
					};
					for (const image of pending) {
						image.addEventListener('load', done, { once: true });
						image.addEventListener('error', done, { once: true });
					}
					setTimeout(resolve, 10_000);
				})
		);
	} catch {
		notes.push('images-not-ready');
	}
	await page.waitForTimeout(settleMs);
	if (!(await waitQuiet(page, 900, Math.min(idleTimeout, 6_000)))) notes.push('network-never-quiet-2');
	await parkAnimations(page);
	// Scroll position must be identical for every capture of a scenario.
	await page.evaluate(() => window.scrollTo(0, 0));
	await page.waitForTimeout(150);
	await parkAnimations(page);
	return notes;
}
