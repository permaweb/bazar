// Scenario list. Real ids come from ids.json, written by `run.sh discover`.
import fs from 'node:fs';
import path from 'node:path';

import { DATA_ROOT } from './env.mjs';

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

export function loadIds() {
	const file = path.join(DATA_ROOT, 'ids.json');
	if (!fs.existsSync(file)) throw new Error(`missing ${file} — run "./run.sh discover <ref>" first`);
	return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function buildScenarios(ids = loadIds()) {
	const collection = ids.collections[0];
	const unique = ids.uniqueAsset;
	// Prefer a token the marketplace actually lists; the shipped default id is not live data and
	// renders the "Asset not found" route state.
	const fungible = ids.fungibleAsset ?? `${ids.fungibleCollectionId}/${ids.fungibleAssetId}`;
	const profile = ids.profiles[0];
	const audio = ids.audioAssets[0];
	const walletAddress = ids.profiles[0];
	// Dispatch addresses a token process directly, so reuse the same live token.
	const dispatchProcess = fungible.split('/')[1];

	const list = [];
	const add = (scenario) => {
		if (scenario.route.includes('undefined') || scenario.route.includes('//#')) return;
		list.push(scenario);
	};

	// --- main routes, both viewports -------------------------------------------------------
	for (const [name, route] of [
		['discover', '#/discover'],
		['collections', '#/collections'],
		['activity', '#/activity'],
		['create', '#/create'],
	]) {
		add({ name: `${name}-desktop`, route, viewport: DESKTOP });
		add({ name: `${name}-mobile`, route, viewport: MOBILE });
	}

	// --- collection surfaces ---------------------------------------------------------------
	if (collection) {
		add({ name: 'collection-desktop', route: `#/collection/${collection}`, viewport: DESKTOP });
		add({ name: 'collection-mobile', route: `#/collection/${collection}`, viewport: MOBILE });
		add({
			name: 'collection-activity-desktop',
			route: `#/collection/${collection}/activity`,
			viewport: DESKTOP,
		});
		add({
			name: 'collection-tab-offers-desktop',
			route: `#/collection/${collection}`,
			viewport: DESKTOP,
			steps: [{ click: 'nav.collection-tabs >> text=Offers', waitMs: 800 }],
		});
	}

	// --- unique asset ----------------------------------------------------------------------
	if (unique) {
		add({ name: 'asset-unique-desktop', route: `#/asset/${unique}`, viewport: DESKTOP });
		add({ name: 'asset-unique-mobile', route: `#/asset/${unique}`, viewport: MOBILE });
		for (const tab of ['orders', 'activity', 'rights', 'blockchain']) {
			add({
				name: `asset-unique-tab-${tab}`,
				route: `#/asset/${unique}`,
				viewport: DESKTOP,
				steps: [{ click: `#asset-${tab}-tab`, waitFor: `#asset-${tab}`, waitMs: 600 }],
			});
		}
		add({ name: 'asset-pending-desktop', route: `#/asset/${unique}/pending`, viewport: DESKTOP });
	}

	// --- fungible token (view and chart load lazily) ---------------------------------------
	add({ name: 'asset-fungible-desktop', route: `#/asset/${fungible}`, viewport: DESKTOP, settleMs: 2500 });
	add({ name: 'asset-fungible-mobile', route: `#/asset/${fungible}`, viewport: MOBILE, settleMs: 2500 });
	for (const tab of ['holders', 'about']) {
		add({
			name: `asset-fungible-tab-${tab}`,
			route: `#/asset/${fungible}`,
			viewport: DESKTOP,
			settleMs: 2500,
			steps: [{ click: `#fungible-asset-${tab}-tab`, waitFor: `#fungible-asset-${tab}`, waitMs: 800 }],
		});
	}

	if (audio) add({ name: 'asset-audio-desktop', route: `#/asset/${audio}`, viewport: DESKTOP });

	// --- profile, dispatch ------------------------------------------------------------------
	if (profile) {
		add({ name: 'profile-desktop', route: `#/profile/${profile}`, viewport: DESKTOP });
		add({ name: 'profile-mobile', route: `#/profile/${profile}`, viewport: MOBILE });
	}
	add({ name: 'dispatch-desktop', route: `#/dispatch/${dispatchProcess}`, viewport: DESKTOP });

	// --- overlays ---------------------------------------------------------------------------
	add({
		name: 'search-dialog-desktop',
		route: '#/discover',
		viewport: DESKTOP,
		steps: [{ click: 'form.site-search input', waitFor: '.search-panel', waitMs: 700 }],
	});
	add({
		name: 'search-dialog-mobile',
		route: '#/discover',
		viewport: MOBILE,
		steps: [{ click: 'form.site-search input', waitFor: '.search-panel', waitMs: 700 }],
	});
	add({
		name: 'wallet-dialog-desktop',
		route: '#/discover',
		viewport: DESKTOP,
		steps: [{ click: 'button.wallet', waitFor: '.wallet-connect-dialog', waitMs: 700 }],
	});
	add({
		name: 'gateway-control-desktop',
		route: '#/discover',
		viewport: DESKTOP,
		steps: [{ click: 'details.gateway > summary', waitFor: 'details.gateway[open] #gateway-panel', waitMs: 600 }],
	});
	add({
		name: 'gateway-control-mobile',
		route: '#/discover',
		viewport: MOBILE,
		steps: [{ click: 'details.gateway > summary', waitFor: 'details.gateway[open] #gateway-panel', waitMs: 600 }],
	});

	// --- themes -------------------------------------------------------------------------------
	add({ name: 'discover-dark', route: '#/discover', viewport: DESKTOP, theme: 'dark', colorScheme: 'dark' });
	add({ name: 'discover-dimmed', route: '#/discover', viewport: DESKTOP, theme: 'dimmed', colorScheme: 'dark' });

	// --- connected wallet (read-only fake provider; signing throws) ----------------------------
	add({ name: 'discover-connected', route: '#/discover', viewport: DESKTOP, wallet: walletAddress });
	add({
		name: 'wallet-menu-connected',
		route: '#/discover',
		viewport: DESKTOP,
		wallet: walletAddress,
		steps: [{ click: 'button.wallet', waitFor: '.wallet-dropdown', waitMs: 700 }],
	});
	if (profile) {
		add({
			name: 'profile-connected-desktop',
			route: `#/profile/${walletAddress}`,
			viewport: DESKTOP,
			wallet: walletAddress,
		});
	}
	add({
		name: 'asset-fungible-connected',
		route: `#/asset/${fungible}`,
		viewport: DESKTOP,
		wallet: walletAddress,
		settleMs: 2500,
	});

	return list;
}
