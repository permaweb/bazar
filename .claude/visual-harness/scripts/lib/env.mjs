// Shared paths and constants. HARNESS_ROOT defaults to the directory that holds `scripts/`,
// so the harness works from the scratchpad copy and from the mirrored .claude/visual-harness copy.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const HARNESS_ROOT = process.env.HARNESS_ROOT
	? path.resolve(process.env.HARNESS_ROOT)
	: path.resolve(here, '..', '..');

// Where refs/captures/recordings/reports live. Defaults to HARNESS_ROOT, but the mirrored copy
// under .claude/visual-harness sets VR_DATA to the scratchpad so the repo never holds artefacts.
export const DATA_ROOT = process.env.VR_DATA ? path.resolve(process.env.VR_DATA) : HARNESS_ROOT;

export const REPO = process.env.VR_REPO || '/Users/nickj/arc/repos/bazar/.claude/worktrees/integration';
export const NODE_MODULES = process.env.VR_NODE_MODULES || path.join(REPO, 'node_modules');
export const PLAYWRIGHT_DIR =
	process.env.VR_PLAYWRIGHT || '/Users/nickj/arc/permaweb-ux-monitor/node_modules/playwright-core';
export const CHROMIUM =
	process.env.VR_CHROMIUM ||
	path.join(
		process.env.HOME,
		'Library/Caches/ms-playwright/chromium-1194/chrome-mac/Chromium.app/Contents/MacOS/Chromium'
	);

export const DIRS = {
	refs: path.join(DATA_ROOT, 'refs'),
	captures: path.join(DATA_ROOT, 'captures'),
	recordings: path.join(DATA_ROOT, 'recordings'),
	reports: path.join(DATA_ROOT, 'reports'),
	build: path.join(DATA_ROOT, 'build'),
};

export function ensureDirs() {
	for (const dir of Object.values(DIRS)) fs.mkdirSync(dir, { recursive: true });
}

export async function loadPlaywright() {
	const mod = await import(path.join(PLAYWRIGHT_DIR, 'index.js'));
	return mod.default ?? mod;
}

/** Resolve a `<ref|dist>` argument to a directory containing index.html. */
export function resolveDist(target) {
	const asRef = path.join(DIRS.refs, target, 'dist');
	if (fs.existsSync(path.join(asRef, 'index.html'))) return asRef;
	const asPath = path.resolve(target);
	if (fs.existsSync(path.join(asPath, 'index.html'))) return asPath;
	throw new Error(`no dist found for "${target}" (looked in ${asRef} and ${asPath})`);
}

// Must sit just AFTER the moment the recordings were taken. A clock set before the recorded block
// timestamps makes the app clamp every relative time to "1 second ago", which is deterministic but
// exercises almost none of the timestamp UI. Change it only together with a re-record.
export const FIXED_TIME = new Date('2026-09-24T20:00:00.000Z');
export const TIMEZONE = 'UTC';
export const LOCALE = 'en-US';
