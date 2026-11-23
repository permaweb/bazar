import { describe, expect, it } from 'vitest';

import type { AssetCandidate, ResolvedAsset } from 'api/asset-discovery';

import {
	assetGroupRevealAnnouncement,
	assetGroupRevealComplete,
	retainedAssetGroupLimit,
} from '../helpers/progressive-assets';
import {
	listedUniquePrice,
	walletAssetGroupEmptyCopy,
	walletAssetGroupEntries,
	walletFailureBlock,
	walletResolutionSlot,
	walletStatusAnnouncement,
} from '../routes/MyAssetsRoute';

import {
	type CandidateSupportFailure,
	groupWalletResults,
	nextWalletAnnouncementProgress,
	refreshCandidateRetryMetadata,
	reopenWalletCandidate,
	trackRateLimitFailure,
	updateWalletResolvedAsset,
	walletDiscoveryScope,
	walletDiscoverySession,
	walletDiscoverySessionIsCurrent,
	walletResolutionCopy,
	walletResolutionIsDeterminate,
	walletResolutionShowsProgress,
	walletUnavailableCandidatesCopy,
} from './App';

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
		// Collections are not part of the scope: streaming collections refine the
		// running session instead of replacing it.
		const scope = walletDiscoveryScope(wallet, 'https://arweave.net');
		const session = walletDiscoverySession(undefined, `${scope}|refresh:0`, wallet);
		session.complete = true;

		expect(walletDiscoverySession(session, `${scope}|refresh:0`, wallet)).toBe(session);
		expect(walletDiscoverySession(session, `${scope}|refresh:1`, wallet)).not.toBe(session);
		expect(walletDiscoveryScope('X'.repeat(43), 'https://arweave.net')).not.toBe(scope);
		expect(walletDiscoveryScope(wallet, 'https://other.example')).not.toBe(scope);
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

		trackRateLimitFailure(rateLimits, processId, new Error('asset-support-graphql-429'));
		expect(rateLimits.has(processId)).toBe(true);
		trackRateLimitFailure(rateLimits, processId, new Error('asset-support-graphql-503'));
		expect(rateLimits.has(processId)).toBe(false);
		trackRateLimitFailure(rateLimits, processId, new Error('asset-support-graphql-429'));
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
			error: 'Discovery interrupted.',
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

describe('wallet assets failure block', () => {
	const done = { error: null, failures: 0, phase: 'done' as const };

	it('shows one failure block per wallet assets surface', () => {
		// Partial failure with nothing visible: only the empty state (it carries the failure copy and Retry).
		expect(walletFailureBlock({ ...done, failures: 2 }, 0)).toBe('empty');
		// Partial failure above assets that are visible: only the banner.
		expect(walletFailureBlock({ ...done, failures: 2 }, 3)).toBe('partial');
		// Discovery error wins over every other block.
		expect(walletFailureBlock({ error: 'Index unavailable.', failures: 2, phase: 'error' }, 0)).toBe('error');
		expect(walletFailureBlock({ error: 'Index unavailable.', failures: 0, phase: 'error' }, 3)).toBe('error');
	});

	it('does not leave an empty group checking after discovery fails', () => {
		expect(walletAssetGroupEmptyCopy('tokens', false, false)).toBe('Checking for tokens…');
		expect(walletAssetGroupEmptyCopy('uniques', false, true)).toBe('Could not check for uniques.');
		expect(walletAssetGroupEmptyCopy('listed tokens', true, false)).toBe('No listed tokens.');
	});

	it('shows no failure block while resolving or when everything resolved', () => {
		expect(walletFailureBlock({ error: null, failures: 1, phase: 'resolving' }, 0)).toBe('none');
		expect(walletFailureBlock(done, 3)).toBe('none');
		expect(walletFailureBlock(done, 0)).toBe('empty');
	});
});

describe('wallet live-state notice', () => {
	const done = {
		phase: 'done' as const,
		discoveryComplete: true,
		discovered: 14,
		resolved: 14,
		total: 14,
		failures: 2,
		indexFailures: 0,
		rateLimited: 0,
		indexRateLimited: 0,
		error: null,
	};
	const failure = 'Live state could not be read through the configured AO peers.';

	it('names only the candidates that could not be checked', () => {
		expect(walletUnavailableCandidatesCopy(done, failure)).toBe(
			'Live state could not be read through the configured AO peers. 2 of 14 candidates could not be checked.'
		);
		expect(walletUnavailableCandidatesCopy({ failures: 1, total: 1 }, '')).toBe(
			'1 of 1 candidate could not be checked.'
		);
		// The status region and the visible banner use the same sentence.
		expect(walletResolutionCopy(done, failure).announcement).toBe(walletUnavailableCandidatesCopy(done, failure));
	});

	it('keeps the status slot above the groups once checks finish, so painted cards hold still', () => {
		const working = { ...done, phase: 'resolving' as const };
		expect(walletResolutionSlot(working, 'none', true, 'Checking asset candidates. 50% complete.')).toEqual({
			settled: false,
		});
		// Partial: a short count in the slot; the full explanation and Retry sit after the groups.
		expect(walletResolutionSlot(done, 'partial', false, 'unused')).toEqual({
			settled: true,
			detail: '2 of 14 candidates could not be checked.',
		});
		const clean = { ...done, failures: 0 };
		expect(walletResolutionSlot(clean, 'none', false, 'Live state resolved for 14 candidates.')).toEqual({
			settled: true,
			detail: 'Live state resolved for 14 candidates.',
		});
		// The empty state and a discovery error carry their own blocks.
		expect(walletResolutionSlot(done, 'empty', false, '')).toBeNull();
		expect(walletResolutionSlot({ ...done, phase: 'error' }, 'error', false, '')).toBeNull();
	});

	it('leaves one live-state message once a visible notice states the outcome', () => {
		const announcement = walletResolutionCopy(done, failure).announcement;
		expect(walletStatusAnnouncement(walletFailureBlock(done, 3), done.failures, announcement)).toBe('');
		expect(walletStatusAnnouncement(walletFailureBlock(done, 0), done.failures, announcement)).toBe('');
		expect(walletStatusAnnouncement('error', 0, '')).toBe('');
		// Progress and a clean finish still announce through the status region.
		expect(walletStatusAnnouncement('none', 0, 'Checking asset candidates. 50% complete.')).toBe(
			'Checking asset candidates. 50% complete.'
		);
		expect(walletStatusAnnouncement('empty', 0, 'Live state resolved for 3 candidates.')).toBe(
			'Live state resolved for 3 candidates.'
		);
	});
});

describe('wallet asset group entries', () => {
	it('places previews in activity order so confirmation updates a card in place', () => {
		const newer = {
			...resolved('newer', '1', '0'),
			activity: { processId: 'newer', height: 30, timestamp: 30, sources: ['transfer' as const] },
		};
		const older = {
			...resolved('older', '1', '0'),
			activity: { processId: 'older', height: 10, timestamp: 10, sources: ['transfer' as const] },
		};
		const preview = {
			asset: { id: 'middle', name: 'Middle' },
			collection: newer.collection,
			activity: { processId: 'middle', height: 20, timestamp: 20, sources: ['transfer' as const] },
			state: 'checking' as const,
		};

		expect(walletAssetGroupEntries([newer, older], [preview]).map((entry) => entry.id)).toEqual([
			'newer',
			'middle',
			'older',
		]);
		expect(walletAssetGroupEntries([], [preview])[0]).toEqual({ id: 'middle', preview });
	});
});
