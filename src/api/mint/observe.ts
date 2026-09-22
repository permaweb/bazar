import { readAssetState } from 'api/marketplace';

import type { MintActivity } from './activity';

export async function observeMintActivity(
	activity: MintActivity,
	onPhase: (phase: MintActivity['phase']) => void,
	signal: AbortSignal
) {
	let mined = activity.phase === 'mined' || activity.phase === 'applied' || activity.phase === 'complete';
	while (!signal.aborted) {
		try {
			await readAssetState(activity.asset.id, {
				provider: activity.computeGateway || undefined,
				maxAge: 0,
				maxAttempts: 1,
				signal,
			});
			if (!mined) onPhase('mined');
			onPhase('applied');
			onPhase('complete');
			return;
		} catch (cause) {
			if (signal.aborted) throw cause;
		}

		let retryDelay = 4_000;
		if (!mined) {
			try {
				const response = await fetch(
					`${activity.arweaveGateway.replace(/\/$/, '')}/tx/${activity.asset.id}/status`,
					{ cache: 'no-store', signal }
				);
				if (response.ok) {
					const payload = (await response.json()) as { block_height?: unknown };
					if (Number(payload.block_height) > 0) {
						mined = true;
						onPhase('mined');
					}
				} else if (response.status === 429) {
					retryDelay = retryAfterDelay(response.headers.get('retry-after'), 4_000);
				}
			} catch (cause) {
				if (signal.aborted) throw cause;
				// Observation failures never create or upload another transaction.
			}
		}
		await waitForBackgroundObservation(retryDelay, signal);
	}
}

function retryAfterDelay(value: string | null, fallback: number) {
	if (!value) return fallback;
	const seconds = Number(value.trim());
	if (Number.isFinite(seconds)) return Math.min(60_000, Math.max(fallback, seconds * 1_000));
	const date = Date.parse(value);
	return Number.isFinite(date) ? Math.min(60_000, Math.max(fallback, date - Date.now())) : fallback;
}

function waitForBackgroundObservation(milliseconds: number, signal: AbortSignal) {
	return new Promise<void>((resolve, reject) => {
		const timer = window.setTimeout(() => {
			signal.removeEventListener('abort', abort);
			resolve();
		}, milliseconds);
		const abort = () => {
			window.clearTimeout(timer);
			signal.removeEventListener('abort', abort);
			reject(signal.reason);
		};
		if (signal.aborted) abort();
		else signal.addEventListener('abort', abort, { once: true });
	});
}
