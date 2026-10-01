// Shared page driving: load a scenario, run its steps, and wait for a stable frame.
import { parkAnimations, settle } from './browser.mjs';

/**
 * Load and stabilise a page.
 *
 * In record mode the gateways rate-limit, so this keeps settling while the recorder is still
 * fetching or still discovering new requests, and it clicks the app's own Retry button when a
 * panel gave up. In replay mode one settle pass is enough because every response is local.
 */
export async function drivePage(page, { scenario, origin, cache, mode, budgetMs = 600_000 }) {
	const notes = [];
	await page.goto(`${origin}/${scenario.route}`, { waitUntil: 'load' });

	if (mode === 'record') {
		const deadline = Date.now() + budgetMs;
		let stableRounds = 0;
		while (Date.now() < deadline && stableRounds < 2) {
			const before = cache.stats.recorded;
			// drain() is the authoritative wait while recording; networkidle would just burn its timeout.
			const drained = await cache.drain(Math.max(5_000, deadline - Date.now()));
			if (!drained) notes.push('recorder-drain-timeout');
			notes.push(...(await settle(page, { settleMs: 1200, idleTimeout: 8_000, loaderTimeout: 8_000 })));
			const retry = await page
				.locator('button:has-text("Retry")')
				.first()
				.count()
				.catch(() => 0);
			if (retry > 0) {
				await page
					.locator('button:has-text("Retry")')
					.first()
					.click({ timeout: 5_000 })
					.catch(() => {});
				stableRounds = 0;
				continue;
			}
			stableRounds = cache.stats.recorded === before ? stableRounds + 1 : 0;
		}
		await cache.drain(60_000);
	}

	notes.push(...(await settle(page, { settleMs: scenario.settleMs ?? 1200 })));

	for (const step of scenario.steps ?? []) {
		notes.push(...(await runStep(page, step)));
		notes.push(...(await settle(page, { settleMs: step.settleMs ?? 900 })));
		if (mode === 'record') {
			await cache.drain(120_000);
			notes.push(...(await settle(page, { settleMs: 900 })));
		}
	}

	await parkAnimations(page);
	return [...new Set(notes)];
}

/**
 * A step that cannot run is recorded as a note rather than failing the capture: some controls are
 * legitimately disabled for the data being replayed (the fungible Holders tab, for instance, is
 * aria-disabled when holder data is unavailable). Both builds replay the same data, so both fail
 * the step identically and the scenario stays comparable — the note says so in the report.
 */
async function runStep(page, step) {
	const notes = [];
	if (step.click) {
		try {
			await page
				.locator(step.click)
				.first()
				.click({ timeout: 15_000, force: step.force ?? false });
		} catch (error) {
			notes.push(`step-click-failed:${step.click}`);
		}
	}
	if (step.waitFor) {
		try {
			await page.waitForSelector(step.waitFor, { timeout: 20_000 });
		} catch {
			notes.push(`step-waitfor-missing:${step.waitFor}`);
		}
	}
	if (step.waitMs) await page.waitForTimeout(step.waitMs);
	return notes;
}
