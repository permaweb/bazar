import { describe, expect, it } from 'vitest';

import type { AssetCandidate, ResolvedAsset } from 'api/discovery';

import { listedUniquePrice } from 'features/MyAssets/model/wallet-assets';
import {
	candidateCheckOutcome,
	type CandidateSupportFailure,
	groupWalletResults,
	initialWalletResolutionStatus,
	nextWalletAnnouncementProgress,
	refreshCandidateRetryMetadata,
	reopenWalletCandidate,
	trackRateLimitFailure,
	updateWalletResolvedAsset,
	walletDiscoveryError,
	walletDiscoveryScope,
	walletDiscoverySession,
	walletDiscoverySessionIsCurrent,
	walletResolutionCopy,
	type WalletResolutionEvent,
	walletResolutionFailureMessage,
	walletResolutionIsDeterminate,
	walletResolutionIsWorking,
	walletResolutionReducer,
	walletResolutionShowsProgress,
	type WalletResolutionStatus,
} from 'features/MyAssets/model/wallet-resolution';
import { appError, appErrorMessage, requestFailureMessage } from 'helpers/app-error';
import {
	assetGroupRevealAnnouncement,
	assetGroupRevealComplete,
	retainedAssetGroupLimit,
} from 'helpers/progressive-assets';

const processId = 'P'.repeat(43);

function candidate(height: number, activityId?: string): AssetCandidate {
	return {
		processId,
		height,
		timestamp: height,
		sources: ['transfer'],
		...(activityId ? { activityIds: [activityId] } : {}),
	};
}

function resolved(id: string, liquid: string, listed: string): ResolvedAsset {
	const orderId = `${id}-order`;
	return {
		asset: { id, name: id },
		collection: { id: 'tokens', name: 'Tokens', description: '', kind: 'tokens', assets: [] },
		provider: 'https://arweave.net',
		activity: { processId: id, height: 1, timestamp: 1, sources: ['market-action'] },
		state: {
			device: 'token@1.0',
			name: id,
			ticker: id,
			denomination: 0,
			totalSupply: '100',
			balances: { [wallet]: liquid },
			orders:
				listed === '0'
					? {}
					: {
							[orderId]: {
								orderId,
								creator: wallet,
								recipient: id,
								asking: '1',
								deposit: '0',
								minimumFee: '0',
								deadline: 100,
								createdAt: 1,
								quantity: listed,
								status: 'open',
							},
					  },
			swapHeight: 1,
			value: null,
			raw: {},
		},
	};
}

const wallet = 'W'.repeat(43);

describe('My assets retry bookkeeping', () => {
	it('never collapses a revealed inventory when the responsive page size shrinks', () => {
		expect(retainedAssetGroupLimit(96, 24)).toBe(96);
		expect(retainedAssetGroupLimit(24, 48)).toBe(48);
	});

	it('does not focus a completion summary after another asset arrives', () => {
		expect(assetGroupRevealComplete(96, 96)).toBe(true);
		expect(assetGroupRevealComplete(96, 97)).toBe(false);
		expect(assetGroupRevealAnnouncement(96, 97, 'owned assets')).toBe('Showing 96 of 97 owned assets.');
		expect(assetGroupRevealAnnouncement(97, 97, 'owned assets')).toBe('All 97 owned assets are shown.');
	});

	it('resumes only the same in-memory discovery scope and replaces explicit refreshes', () => {
		const collections = [
			{
				id: 'tokens',
				name: 'Tokens',
				description: '',
				kind: 'tokens' as const,
				assets: [],
				manifestId: 'M'.repeat(43),
			},
		];
		const scope = walletDiscoveryScope(wallet, 'https://arweave.net', collections);
		const session = walletDiscoverySession(undefined, `${scope}|refresh:0`, wallet);
		session.complete = true;

		expect(walletDiscoverySession(session, `${scope}|refresh:0`, wallet)).toBe(session);
		expect(walletDiscoverySession(session, `${scope}|refresh:1`, wallet)).not.toBe(session);
		expect(walletDiscoveryScope('X'.repeat(43), 'https://arweave.net', collections)).not.toBe(scope);
		expect(walletDiscoveryScope(wallet, 'https://other.example', collections)).not.toBe(scope);
		expect(walletDiscoverySessionIsCurrent(session, `${scope}|refresh:0`)).toBe(true);
		expect(walletDiscoverySessionIsCurrent(session, `${scope}|refresh:1`)).toBe(false);
		expect(walletDiscoverySessionIsCurrent(session, '')).toBe(false);
	});

	it('announces large candidate discovery at bounded milestones', () => {
		const status = {
			phase: 'discovering' as const,
			discoveryComplete: false,
			discovered: 104,
			resolved: 40,
			total: 104,
			failures: 0,
			indexFailures: 0,
			rateLimited: 0,
			indexRateLimited: 0,
			error: null,
		};
		const first = nextWalletAnnouncementProgress({ scope: '', discovered: 0, revalidated: 0 }, status, 'wallet-a');
		const quiet = nextWalletAnnouncementProgress(first, { ...status, discovered: 404 }, 'wallet-a');
		const milestone = nextWalletAnnouncementProgress(quiet, { ...status, discovered: 501 }, 'wallet-a');
		const complete = nextWalletAnnouncementProgress(
			milestone,
			{
				...status,
				phase: 'done',
				discoveryComplete: true,
				discovered: 16_000,
			},
			'wallet-a'
		);

		expect(first.discovered).toBe(104);
		expect(quiet).toEqual(first);
		expect(milestone.discovered).toBe(500);
		expect(complete.discovered).toBe(16_000);
		expect(nextWalletAnnouncementProgress(complete, status, 'wallet-b')).toEqual({
			scope: 'wallet-b',
			discovered: 104,
			revalidated: 0,
		});
	});

	it('announces terminal ownership revalidation only at bounded milestones', () => {
		let progress = { scope: '', discovered: 0, revalidated: 0 };
		const announcements = new Set<string>();
		for (let revalidated = 0; revalidated <= 104; revalidated += 1) {
			const status = {
				phase: 'revalidating' as const,
				discoveryComplete: true,
				discovered: 104,
				resolved: 104,
				total: 104,
				failures: 0,
				indexFailures: 0,
				rateLimited: 0,
				indexRateLimited: 0,
				revalidated,
				revalidationTotal: 104,
				error: null,
			};
			progress = nextWalletAnnouncementProgress(progress, status, 'wallet-a');
			announcements.add(
				walletResolutionCopy(
					{
						...status,
						revalidated: progress.revalidated,
					},
					''
				).announcement
			);
		}

		expect(announcements.size).toBeLessThanOrEqual(12);
		expect([...announcements].at(-1)).toBe(
			'Confirming current ownership. 104 of 104 visible assets rechecked without cached state.'
		);
	});

	it('groups each live result once while preserving assets in both sections', () => {
		const both = resolved('both', '2', '3');
		const owned = resolved('owned', '2', '0');
		const listed = resolved('listed', '0', '3');
		const groups = groupWalletResults([both, owned, listed], wallet);

		expect(groups.owned).toEqual([both, owned]);
		expect(groups.listed).toEqual([both, listed]);
	});

	it('shows the wallet listing price for a unique asset', () => {
		const listed = resolved('listed-unique', '0', '1');
		listed.collection = { ...listed.collection, kind: 'images' };
		listed.state.totalSupply = '1';
		listed.state.orders['listed-unique-order'].asking = '2500000000000';

		expect(listedUniquePrice(listed, wallet)).toBe('2.5 AR');
		expect(listedUniquePrice(listed, 'X'.repeat(43))).toBeUndefined();
	});

	it('writes retry recovery through the active resumable session', () => {
		const scope = `${wallet}|https://arweave.net|refresh:0`;
		const session = walletDiscoverySession(undefined, scope, wallet);
		const current = candidate(30);
		session.latestCandidates.set(processId, current);

		expect(updateWalletResolvedAsset(session, resolved(processId, '2', '0'), current, wallet)).toBe(true);
		expect(session.resolvedAssets.get(processId)?.activity).toBe(current);
		expect(updateWalletResolvedAsset(session, null, current, wallet)).toBe(true);
		expect(session.resolvedAssets.has(processId)).toBe(false);
	});

	it('reopens a settled candidate when later discovery finds newer activity', () => {
		const scope = `${wallet}|https://arweave.net|refresh:0`;
		const session = walletDiscoverySession(undefined, scope, wallet);
		const earlier = candidate(10);
		session.latestCandidates.set(processId, earlier);
		session.counted.add(processId);
		session.screened.add(processId);
		session.completed.add(processId);
		session.resolvedAssets.set(processId, resolved(processId, '2', '0'));

		expect(reopenWalletCandidate(session, candidate(10))).toEqual({
			reopened: false,
			completed: false,
			removedResult: false,
		});
		expect(reopenWalletCandidate(session, candidate(30))).toEqual({
			reopened: true,
			completed: true,
			removedResult: true,
		});
		expect(session.counted.has(processId)).toBe(true);
		expect(session.screened.has(processId)).toBe(false);
		expect(session.completed.has(processId)).toBe(false);
		expect(session.resolvedAssets.has(processId)).toBe(false);
	});

	it('reopens a settled candidate for a distinct transaction in the same block', () => {
		const scope = `${wallet}|https://arweave.net|refresh:0`;
		const session = walletDiscoverySession(undefined, scope, wallet);
		const earlier = candidate(10, 'A'.repeat(43));
		session.latestCandidates.set(processId, earlier);
		session.counted.add(processId);
		session.screened.add(processId);
		session.completed.add(processId);
		session.resolvedAssets.set(processId, resolved(processId, '2', '0'));

		expect(reopenWalletCandidate(session, candidate(10, 'B'.repeat(43)))).toEqual({
			reopened: true,
			completed: true,
			removedResult: true,
		});
	});

	it('keeps the latest activity metadata without losing a support error', () => {
		const computeFailures = new Map([[processId, candidate(10)]]);
		const supportError = new Error('asset-support-graphql-503');
		const supportFailures = new Map<string, CandidateSupportFailure>([
			[processId, { candidate: candidate(10), error: supportError }],
		]);

		refreshCandidateRetryMetadata(candidate(30), computeFailures, supportFailures);

		expect(computeFailures.get(processId)?.height).toBe(30);
		expect(supportFailures.get(processId)).toEqual({ candidate: candidate(30), error: supportError });
	});

	it('reconciles changing rate-limit categories across retries', () => {
		const rateLimits = new Set<string>();

		const rateLimited = appError('rate-limited', { message: 'asset-support-graphql-429' });
		trackRateLimitFailure(rateLimits, processId, rateLimited);
		expect(rateLimits.has(processId)).toBe(true);
		trackRateLimitFailure(rateLimits, processId, appError('unavailable', { message: 'asset-support-graphql-503' }));
		expect(rateLimits.has(processId)).toBe(false);
		trackRateLimitFailure(rateLimits, processId, rateLimited);
		expect(rateLimits.has(processId)).toBe(true);
		trackRateLimitFailure(rateLimits, processId, new Error('asset-support-graphql-429'));
		expect(rateLimits.has(processId)).toBe(false);
		trackRateLimitFailure(rateLimits, processId, rateLimited);
		trackRateLimitFailure(rateLimits, processId);
		expect(rateLimits.has(processId)).toBe(false);
	});

	it('announces support-index failures as candidate verification failures', () => {
		const copy = walletResolutionCopy(
			{
				phase: 'done',
				discoveryComplete: true,
				discovered: 4,
				resolved: 4,
				total: 4,
				failures: 4,
				indexFailures: 4,
				rateLimited: 4,
				indexRateLimited: 4,
				error: null,
			},
			'Arweave’s transaction index is temporarily rate-limiting requests.'
		);

		expect(copy.heading).toBe('Candidate checks unavailable');
		expect(copy.announcement).toContain('transaction index');
		expect(copy.announcement).not.toContain('Live state resolved');
	});

	it('labels the zero-age terminal ownership pass independently from candidate checks', () => {
		const copy = walletResolutionCopy(
			{
				phase: 'revalidating',
				discoveryComplete: true,
				discovered: 104,
				resolved: 104,
				total: 104,
				failures: 0,
				indexFailures: 0,
				rateLimited: 0,
				indexRateLimited: 0,
				revalidated: 80,
				revalidationTotal: 101,
				error: null,
			},
			''
		);

		expect(copy.heading).toBe('Confirming current ownership');
		expect(copy.announcement).toBe(
			'Confirming current ownership. 80 of 101 visible assets rechecked without cached state.'
		);
	});

	it('keeps interrupted candidate discovery indeterminate', () => {
		const interrupted = {
			phase: 'error' as const,
			discoveryComplete: false,
			discovered: 100,
			resolved: 100,
			total: 100,
			failures: 0,
			indexFailures: 0,
			rateLimited: 0,
			indexRateLimited: 0,
			error: appError('index-unavailable'),
		};

		expect(walletResolutionIsDeterminate(interrupted)).toBe(false);
		expect(walletResolutionShowsProgress(interrupted)).toBe(false);
		expect(walletResolutionCopy(interrupted, '').announcement).toBe('');
		expect(
			walletResolutionIsDeterminate({
				...interrupted,
				phase: 'done',
				discoveryComplete: true,
				error: null,
			})
		).toBe(true);
		expect(
			walletResolutionShowsProgress({
				...interrupted,
				phase: 'discovering',
				error: null,
			})
		).toBe(true);
	});
});

function reduce(events: WalletResolutionEvent[], status: WalletResolutionStatus = initialWalletResolutionStatus()) {
	return events.reduce(walletResolutionReducer, status);
}

describe('wallet resolution state machine', () => {
	it('classifies each candidate check once for the failure counters', () => {
		expect(candidateCheckOutcome()).toBe('resolved');
		expect(candidateCheckOutcome(appError('compute-rate-limited'))).toBe('rate-limited');
		expect(candidateCheckOutcome(appError('compute-unavailable'))).toBe('unavailable');
		expect(candidateCheckOutcome(new Error('opaque provider failure'))).toBe('unavailable');
	});

	it('counts a discovery pass from screening through revalidated completion', () => {
		const status = reduce([
			{ type: 'page-screened', discovered: 3, counted: 3, resolving: true },
			{ type: 'revalidation-scheduled' },
			{ type: 'candidate-settled', outcome: 'resolved' },
			{ type: 'candidate-settled', outcome: 'rate-limited' },
			{ type: 'support-checked', checked: 1, unavailable: 1, rateLimited: 0 },
			{ type: 'revalidating' },
			{ type: 'candidate-revalidated', outcome: 'resolved' },
		]);

		expect(status).toMatchObject({
			phase: 'revalidating',
			discoveryComplete: true,
			discovered: 3,
			total: 3,
			resolved: 3,
			failures: 2,
			indexFailures: 1,
			rateLimited: 1,
			indexRateLimited: 0,
			revalidated: 1,
			revalidationTotal: 1,
		});
		expect(walletResolutionIsWorking(status)).toBe(true);

		const done = walletResolutionReducer(status, { type: 'completed', discovered: 4 });
		expect(done).toMatchObject({ phase: 'done', discoveryComplete: true, discovered: 4 });
		expect(done.revalidated).toBeUndefined();
		expect(done.revalidationTotal).toBeUndefined();
		expect(walletResolutionIsWorking(done)).toBe(false);
	});

	it('keeps the current phase when a screened page has nothing to resolve', () => {
		const status = reduce([{ type: 'page-screened', discovered: 5, counted: 0, resolving: false }]);
		expect(status.phase).toBe('discovering');
		expect(status.total).toBe(0);
		expect(status.discovered).toBe(5);
	});

	it('reopens settled candidates without letting any counter go negative', () => {
		const status = reduce([
			{ type: 'candidate-settled', outcome: 'rate-limited' },
			{
				type: 'candidates-reopened',
				reopened: 3,
				failures: 2,
				indexFailures: 1,
				rateLimited: 4,
				indexRateLimited: 1,
			},
		]);

		expect(status).toMatchObject({
			resolved: 0,
			failures: 0,
			indexFailures: 0,
			rateLimited: 0,
			indexRateLimited: 0,
		});
	});

	it('retries unavailable candidates and adopts the remaining failure sets as authoritative', () => {
		const failed = reduce([
			{ type: 'page-screened', discovered: 4, counted: 4, resolving: true },
			{ type: 'candidate-settled', outcome: 'rate-limited' },
			{ type: 'candidate-settled', outcome: 'unavailable' },
			{ type: 'support-checked', checked: 2, unavailable: 2, rateLimited: 1 },
			{ type: 'completed', discovered: 4 },
			{ type: 'failed', error: appError('unknown') },
		]);
		const retrying = walletResolutionReducer(failed, {
			type: 'retry-started',
			retried: 4,
			retriedIndex: 2,
			retriedRateLimited: 1,
			retriedIndexRateLimited: 1,
		});

		expect(retrying).toMatchObject({
			phase: 'resolving',
			discoveryComplete: true,
			resolved: 0,
			failures: 0,
			indexFailures: 0,
			rateLimited: 0,
			indexRateLimited: 0,
			error: null,
		});

		const settled = walletResolutionReducer(retrying, {
			type: 'retry-completed',
			failures: 1,
			indexFailures: 1,
			rateLimited: 1,
			indexRateLimited: 1,
		});
		expect(settled).toMatchObject({ phase: 'done', failures: 1, indexFailures: 1, rateLimited: 1 });
	});

	it('resumes an interrupted pass and restarts from nothing on reset', () => {
		const interrupted = reduce([
			{ type: 'page-screened', discovered: 2, counted: 2, resolving: true },
			{ type: 'failed', error: walletDiscoveryError(appError('index-rate-limited')) },
		]);
		expect(interrupted.phase).toBe('error');
		expect(interrupted.error?.reason).toBe('index-rate-limited');

		const resumed = walletResolutionReducer(interrupted, { type: 'resumed' });
		expect(resumed).toMatchObject({ phase: 'discovering', error: null, discovered: 2, total: 2 });
		expect(walletResolutionReducer(resumed, { type: 'reset' })).toEqual(initialWalletResolutionStatus());
	});

	it('reports discovery failures as transaction-index failures with the original classification', () => {
		expect(walletDiscoveryError(appError('compute-rate-limited')).reason).toBe('index-rate-limited');
		expect(walletDiscoveryError(new Error('network down')).reason).toBe('index-unavailable');
		expect(appErrorMessage(walletDiscoveryError(new Error('network down')))).toBe(
			requestFailureMessage('index', 'unavailable')
		);
	});

	it('explains which service left candidates unavailable', () => {
		const base = initialWalletResolutionStatus();
		expect(walletResolutionFailureMessage(base)).toBe('');
		expect(
			walletResolutionFailureMessage({
				...base,
				failures: 2,
				indexFailures: 2,
				indexRateLimited: 1,
				rateLimited: 1,
			})
		).toBe(requestFailureMessage('index', 'rate-limited'));
		expect(walletResolutionFailureMessage({ ...base, failures: 3, indexFailures: 1, rateLimited: 1 })).toBe(
			`${requestFailureMessage('index', 'unavailable')} ${requestFailureMessage('compute', 'rate-limited')}`
		);
	});
});
