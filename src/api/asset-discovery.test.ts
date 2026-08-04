import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Collection } from './collections';
import {
	createWalletCandidateScan,
	discoverWalletAssetCandidates,
	discoverCollectionActivity,
	discoverCollectionActivityBatched,
	discoverMarketActivity,
	discoverMarketActivityBatched,
	partitionAssetCandidateSupport,
	resolveAssetCandidates,
	restrictAssetCandidates,
	verifyAssetCandidateSupport,
	walletAssetGroup,
	type AssetCandidate,
} from './asset-discovery';
import { parseAssetState } from './asset-marketplace';
import { PAGINATED_GRAPHQL } from 'helpers/config';

const wallet = 'W'.repeat(43);
const buyer = 'B'.repeat(43);
const assetA = 'A'.repeat(43);
const assetB = 'C'.repeat(43);
const assetC = 'D'.repeat(43);
const nameAsset = 'N'.repeat(43);
const traditionalName = 'R'.repeat(43);
const outsideName = 'Z'.repeat(43);
const orderId = 'O'.repeat(43);

const collections: Collection[] = [
	{
		id: 'images',
		name: '[TEST] Images',
		description: 'Test',
		kind: 'images',
		assets: [
			{ id: assetA, name: 'Asset A', image: `https://arweave.net/${assetA}` },
			{ id: assetB, name: 'Asset B', image: `https://arweave.net/${assetB}` },
			{ id: assetC, name: 'Asset C', image: `https://arweave.net/${assetC}` },
		],
	},
	{
		id: 'arweave-names',
		name: 'Arweave names',
		description: 'Names',
		kind: 'names',
		assets: [],
		namespace: {
			manifestId: 'I'.repeat(43),
			namesById: {
				[nameAsset]: 'canonical-name',
				[traditionalName]: 'traditional-name',
			},
		},
	},
];

afterEach(() => {
	vi.useRealTimers();
});

describe('wallet candidate discovery', () => {
	it('ends a stalled GraphQL page with a stable timeout', async () => {
		vi.useFakeTimers();
		const fetcher = vi.fn(() => new Promise<Response>(() => undefined));
		const discovery = discoverWalletAssetCandidates(wallet, {
			fetch: fetcher as typeof fetch,
			requestTimeoutMs: 50,
		});
		const rejection = expect(discovery).rejects.toThrow('asset-discovery-graphql-timeout');

		await vi.advanceTimersByTimeAsync(50);
		await rejection;
		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	it('uses one aliased query per page, deduplicates targets, and keeps newest activity first', async () => {
		const pages = [
			{
				data: {
					initiallyHeld: {
						pageInfo: { hasNextPage: true },
						edges: [{
							cursor: 'initial-1',
							node: {
								id: assetA,
								tags: [{ name: 'initial-holder', value: wallet }],
								block: { height: 10, timestamp: 100 },
							},
						}],
					},
					marketActions: {
						pageInfo: { hasNextPage: false },
						edges: [{
							cursor: 'market-1',
							node: {
								id: 'M'.repeat(43),
								recipient: assetA,
								owner: { address: wallet },
								tags: [{ name: 'action', value: 'make-offer' }],
								block: { height: 30, timestamp: 300 },
							},
						}],
					},
					receivedTransfers: {
						pageInfo: { hasNextPage: false },
						edges: [{
							cursor: 'transfer-1',
							node: {
								id: 'T'.repeat(43),
								recipient: assetB,
								tags: [
									{ name: 'action', value: 'transfer' },
									{ name: 'recipient', value: wallet },
								],
								block: { height: 20, timestamp: 200 },
							},
						}],
					},
				},
			},
			{
				data: {
					initiallyHeld: {
						pageInfo: { hasNextPage: false },
						edges: [{
							cursor: 'initial-2',
							node: {
								id: assetC,
								tags: [{ name: 'initial-holder', value: wallet }],
								block: { height: 5, timestamp: 50 },
							},
						}],
					},
				},
			},
		];
		const fetcher = vi.fn(async () => new Response(JSON.stringify(pages.shift()), {
			status: 200,
			headers: { 'content-type': 'application/json' },
		}));

		const candidates = await discoverWalletAssetCandidates(wallet, { fetch: fetcher as typeof fetch });

		expect(fetcher).toHaveBeenCalledTimes(2);
		const firstCall = fetcher.mock.calls[0] as unknown as [RequestInfo | URL, RequestInit];
		expect(firstCall[0]).toBe(PAGINATED_GRAPHQL);
		const firstBody = JSON.parse(String(firstCall[1].body));
		expect(firstBody.query).toContain('initiallyHeld: transactions');
		expect(firstBody.query).toContain('marketActions: transactions');
		expect(firstBody.query).toContain('receivedTransfers: transactions');
		expect(firstBody.query).toContain('@include(if: $includeInitial)');
		expect(firstBody.variables).toMatchObject({
			includeInitial: true,
			includeMarket: true,
			includeTransfers: true,
		});
		const secondCall = fetcher.mock.calls[1] as unknown as [RequestInfo | URL, RequestInit];
		const secondBody = JSON.parse(String(secondCall[1].body));
		expect(secondBody.variables).toMatchObject({
			includeInitial: true,
			includeMarket: false,
			includeTransfers: false,
		});
		expect(firstBody.variables.marketTags[0].values).toEqual(['register-interest', 'make-offer']);
		expect(firstBody.variables.transferTags).toContainEqual({ name: 'recipient', values: [wallet] });
		expect(candidates.map((candidate) => candidate.processId)).toEqual([assetA, assetB, assetC]);
		expect(candidates[0]).toMatchObject({
			height: 30,
			sources: ['initial-holder', 'market-action'],
		});
	});

	it('resumes only the unfinished aliases after a late page failure', async () => {
		const scan = createWalletCandidateScan(wallet);
		const emitted: string[][] = [];
		const firstPage = {
			data: {
				initiallyHeld: {
					pageInfo: { hasNextPage: true },
					edges: [{
						cursor: 'initial-page-1',
						node: {
							id: assetA,
							tags: [{ name: 'initial-holder', value: wallet }],
							block: { height: 30, timestamp: 300 },
						},
					}],
				},
				marketActions: { pageInfo: { hasNextPage: false }, edges: [] },
				receivedTransfers: { pageInfo: { hasNextPage: false }, edges: [] },
			},
		};
		const finalPage = {
			data: {
				initiallyHeld: {
					pageInfo: { hasNextPage: false },
					edges: [{
						cursor: 'initial-page-2',
						node: {
							id: assetB,
							tags: [{ name: 'initial-holder', value: wallet }],
							block: { height: 20, timestamp: 200 },
						},
					}],
				},
			},
		};
		const fetcher = vi.fn()
			.mockResolvedValueOnce(Response.json(firstPage))
			.mockResolvedValueOnce(new Response('', { status: 503 }))
			.mockResolvedValueOnce(Response.json(finalPage));
		const options = {
			fetch: fetcher as typeof fetch,
			scan,
			onPage: (page: AssetCandidate[]) => {
				emitted.push(page.map(({ processId }) => processId));
			},
		};

		await expect(discoverWalletAssetCandidates(wallet, options)).rejects.toThrow('asset-discovery-graphql-503');
		expect([...scan.found.keys()]).toEqual([assetA]);
		expect([...scan.active]).toEqual(['initiallyHeld']);
		expect(scan.cursors.initiallyHeld).toBe('initial-page-1');
		expect(scan.visited.initiallyHeld).toEqual(new Set(['initial-page-1']));

		const result = await discoverWalletAssetCandidates(wallet, options);
		expect(result.map(({ processId }) => processId)).toEqual([assetA, assetB]);
		expect(emitted).toEqual([[assetA], [assetB]]);
		const resumedBody = JSON.parse(String((fetcher.mock.calls[2] as unknown as [unknown, RequestInit])[1].body));
		expect(resumedBody.variables).toMatchObject({
			initialCursor: 'initial-page-1',
			includeInitial: true,
			includeMarket: false,
			includeTransfers: false,
		});
	});

	it('closes a resumed descending scan against transactions inserted at its head', async () => {
		const scan = createWalletCandidateScan(wallet);
		const empty = { pageInfo: { hasNextPage: false }, edges: [] };
		const firstPage = {
			data: {
				initiallyHeld: {
					pageInfo: { hasNextPage: true },
					edges: [{
						cursor: 'initial-head',
						node: {
							id: assetA,
							tags: [{ name: 'initial-holder', value: wallet }],
							block: { height: 30, timestamp: 300 },
						},
					}],
				},
				marketActions: empty,
				receivedTransfers: empty,
			},
		};
		const tailPage = {
			data: {
				initiallyHeld: {
					pageInfo: { hasNextPage: false },
					edges: [{
						cursor: 'initial-tail',
						node: {
							id: assetB,
							tags: [{ name: 'initial-holder', value: wallet }],
							block: { height: 20, timestamp: 200 },
						},
					}],
				},
			},
		};
		const catchUpPage = {
			data: {
				initiallyHeld: {
					pageInfo: { hasNextPage: true },
					edges: [
						{
							cursor: 'new-head',
							node: {
								id: assetC,
								tags: [{ name: 'initial-holder', value: wallet }],
								block: { height: 40, timestamp: 400 },
							},
						},
						{
							cursor: 'old-head',
							node: {
								id: assetA,
								tags: [{ name: 'initial-holder', value: wallet }],
								block: { height: 30, timestamp: 300 },
							},
						},
					],
				},
				marketActions: empty,
				receivedTransfers: empty,
			},
		};
		const closedHeadPage = {
			data: {
				initiallyHeld: {
					pageInfo: { hasNextPage: true },
					edges: [{
						cursor: 'closed-head',
						node: {
							id: assetC,
							tags: [{ name: 'initial-holder', value: wallet }],
							block: { height: 40, timestamp: 400 },
						},
					}],
				},
				marketActions: empty,
				receivedTransfers: empty,
			},
		};
		const fetcher = vi.fn()
			.mockResolvedValueOnce(Response.json(firstPage))
			.mockResolvedValueOnce(new Response('', { status: 503 }))
			.mockResolvedValueOnce(Response.json(tailPage))
			.mockResolvedValueOnce(Response.json(catchUpPage))
			.mockResolvedValueOnce(Response.json(closedHeadPage));
		const emitted: string[][] = [];
		const options = {
			fetch: fetcher as typeof fetch,
			scan,
			catchUp: true,
			onPage: (page: AssetCandidate[]) => {
				emitted.push(page.map(({ processId }) => processId));
			},
		};

		await expect(discoverWalletAssetCandidates(wallet, options)).rejects.toThrow('asset-discovery-graphql-503');
		const result = await discoverWalletAssetCandidates(wallet, options);

		expect(result.map(({ processId }) => processId)).toEqual([assetC, assetA, assetB]);
		expect(emitted).toEqual([[assetA], [assetB], [assetC, assetA], [assetC]]);
		expect(scan.caughtUp).toBe(true);
		expect(scan.heads.initiallyHeld).toBe(assetC);
		expect(fetcher).toHaveBeenCalledTimes(5);
	});

	it('commits no alias state when another included alias or the page consumer fails', async () => {
		const connection = {
			pageInfo: { hasNextPage: true },
			edges: [{
				cursor: 'candidate-page',
				node: {
					id: assetA,
					tags: [{ name: 'initial-holder', value: wallet }],
					block: { height: 10, timestamp: 100 },
				},
			}],
		};
		const missingAliasScan = createWalletCandidateScan(wallet);
		const missingAlias = vi.fn(async () => Response.json({
			data: { initiallyHeld: connection, marketActions: { pageInfo: { hasNextPage: false }, edges: [] } },
		}));
		await expect(discoverWalletAssetCandidates(wallet, {
			fetch: missingAlias as typeof fetch,
			scan: missingAliasScan,
		})).rejects.toThrow('asset-discovery-graphql-schema');
		expect(missingAliasScan.found.size).toBe(0);
		expect(missingAliasScan.cursors.initiallyHeld).toBeNull();
		expect(missingAliasScan.visited.initiallyHeld.size).toBe(0);
		expect(missingAliasScan.active.size).toBe(3);

		const consumerScan = createWalletCandidateScan(wallet);
		const completePayload = {
			data: {
				initiallyHeld: connection,
				marketActions: { pageInfo: { hasNextPage: false }, edges: [] },
				receivedTransfers: { pageInfo: { hasNextPage: false }, edges: [] },
			},
		};
		await expect(discoverWalletAssetCandidates(wallet, {
			fetch: vi.fn(async () => Response.json(completePayload)) as typeof fetch,
			scan: consumerScan,
			onPage: () => { throw new Error('consumer-failed'); },
		})).rejects.toThrow('consumer-failed');
		expect(consumerScan.found.size).toBe(0);
		expect(consumerScan.cursors.initiallyHeld).toBeNull();
		expect(consumerScan.active.size).toBe(3);
	});

	it('resumes a 16,000-candidate scan from its final failed page without replaying 15,900 candidates', async () => {
		const scan = createWalletCandidateScan(wallet);
		const seen = new Map<string, number>();
		const processAt = (index: number) => index.toString().padStart(43, 'A');
		let request = 0;
		const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
			const current = request++;
			if (current === 159) return new Response('', { status: 503 });
			const page = current < 159 ? current : 159;
			const body = JSON.parse(String(init?.body));
			const initiallyHeld = {
				pageInfo: { hasNextPage: page < 159 },
				edges: Array.from({ length: 100 }, (_, offset) => ({
					cursor: `page-${page}-item-${offset}`,
					node: {
						id: processAt(page * 100 + offset),
						tags: [{ name: 'initial-holder', value: wallet }],
						block: { height: 16_000 - page * 100 - offset, timestamp: 1 },
					},
				})),
			};
			return Response.json({
				data: {
					initiallyHeld,
					...(body.variables.includeMarket
						? { marketActions: { pageInfo: { hasNextPage: false }, edges: [] } }
						: {}),
					...(body.variables.includeTransfers
						? { receivedTransfers: { pageInfo: { hasNextPage: false }, edges: [] } }
						: {}),
				},
			});
		});
		const options = {
			fetch: fetcher as typeof fetch,
			scan,
			onPage: (page: AssetCandidate[]) => {
				for (const candidate of page) {
					seen.set(candidate.processId, (seen.get(candidate.processId) ?? 0) + 1);
				}
			},
		};

		await expect(discoverWalletAssetCandidates(wallet, options)).rejects.toThrow('asset-discovery-graphql-503');
		expect(scan.found.size).toBe(15_900);
		expect(scan.active).toEqual(new Set(['initiallyHeld']));
		const result = await discoverWalletAssetCandidates(wallet, options);

		expect(fetcher).toHaveBeenCalledTimes(161);
		expect(result).toHaveLength(16_000);
		expect(seen.size).toBe(16_000);
		expect([...seen.values()].every((count) => count === 1)).toBe(true);
		const resumedBody = JSON.parse(String((fetcher.mock.calls[160] as unknown as [unknown, RequestInit])[1].body));
		expect(resumedBody.variables.initialCursor).toBe('page-158-item-99');
		expect(resumedBody.variables).toMatchObject({
			includeInitial: true,
			includeMarket: false,
			includeTransfers: false,
		});
	});

	it('emits the merged newest activity when aliases contain the same process', async () => {
		const connection = { pageInfo: { hasNextPage: false }, edges: [] };
		const emitted: AssetCandidate[][] = [];
		const fetcher = vi.fn(async () => Response.json({
			data: {
				initiallyHeld: connection,
				marketActions: {
					pageInfo: { hasNextPage: false },
					edges: [{
						cursor: 'newer',
						node: {
							id: 'M'.repeat(43),
							recipient: assetA,
							owner: { address: wallet },
							tags: [{ name: 'action', value: 'make-offer' }],
							block: { height: 30, timestamp: 300 },
						},
					}],
				},
				receivedTransfers: {
					pageInfo: { hasNextPage: false },
					edges: [{
						cursor: 'older',
						node: {
							id: 'T'.repeat(43),
							recipient: assetA,
							tags: [
								{ name: 'action', value: 'transfer' },
								{ name: 'recipient', value: wallet },
							],
							block: { height: 20, timestamp: 200 },
						},
					}],
				},
			},
		}));

		const result = await discoverWalletAssetCandidates(wallet, {
			fetch: fetcher as typeof fetch,
			onPage: (page) => { emitted.push(page); },
		});

		expect(emitted).toEqual([[expect.objectContaining({
			processId: assetA,
			height: 30,
			sources: ['market-action', 'transfer'],
		})]]);
		expect(result[0]).toMatchObject({ processId: assetA, height: 30 });
	});

	it('rejects a successful wallet response with a missing included alias', async () => {
		const connection = { pageInfo: { hasNextPage: false }, edges: [] };
		const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => Response.json({
			data: { initiallyHeld: connection, marketActions: connection },
		}));

		await expect(discoverWalletAssetCandidates(wallet, { fetch: fetcher as typeof fetch })).rejects.toThrow(
			'asset-discovery-graphql-schema',
		);
	});

	it('rejects activity connections without page information or valid edge IDs', async () => {
		const missingPageInfo = vi.fn(async () => Response.json({
			data: { transactions: { edges: [] } },
		}));
		await expect(discoverMarketActivity({ fetch: missingPageInfo as typeof fetch })).rejects.toThrow(
			'asset-activity-graphql-schema',
		);

		const invalidEdge = vi.fn(async () => Response.json({
			data: {
				transactions: {
					pageInfo: { hasNextPage: false },
					edges: [{ cursor: 'cursor', node: { id: 'not-a-transaction' } }],
				},
			},
		}));
		await expect(discoverMarketActivity({ fetch: invalidEdge as typeof fetch })).rejects.toThrow(
			'asset-activity-graphql-schema',
		);
	});

	it('rejects connections that promise another page without an advancing cursor', async () => {
		const stalledConnection = { pageInfo: { hasNextPage: true }, edges: [] };
		const stalledWallet = vi.fn(async () => Response.json({
			data: {
				initiallyHeld: stalledConnection,
				marketActions: { pageInfo: { hasNextPage: false }, edges: [] },
				receivedTransfers: { pageInfo: { hasNextPage: false }, edges: [] },
			},
		}));
		await expect(discoverWalletAssetCandidates(wallet, { fetch: stalledWallet as typeof fetch }))
			.rejects.toThrow('asset-discovery-pagination-stalled');

		const stalledMarket = vi.fn(async () => Response.json({
			data: { transactions: stalledConnection },
		}));
		await expect(discoverMarketActivity({ fetch: stalledMarket as typeof fetch }))
			.rejects.toThrow('asset-activity-pagination-stalled');
		await expect(discoverCollectionActivity({ fetch: stalledMarket as typeof fetch }))
			.rejects.toThrow('collection-activity-pagination-stalled');
	});

	it('rejects stalled pagination while verifying collection activity devices', async () => {
		const fetcher = vi.fn()
			.mockResolvedValueOnce(Response.json({
				data: { transactions: {
					pageInfo: { hasNextPage: false },
					edges: [activityEdge('activity', assetA, 10)],
				} },
			}))
			.mockResolvedValueOnce(Response.json({
				data: { transactions: { pageInfo: { hasNextPage: true }, edges: [] } },
			}));

		await expect(discoverCollectionActivity({
			fetch: fetcher as typeof fetch,
			requiredExecutionDevice: 'token@1.0',
		})).rejects.toThrow('collection-activity-device-pagination-stalled');
	});

	it('rejects a recurring cursor cycle instead of polling forever', async () => {
		const cursors = ['cursor-a', 'cursor-b', 'cursor-a'];
		const fetcher = vi.fn(async () => {
			const cursor = cursors.shift()!;
			return Response.json({
				data: { transactions: {
					pageInfo: { hasNextPage: true },
					edges: [activityEdge(cursor, assetA, 10)],
				} },
			});
		});

		await expect(discoverMarketActivity({ fetch: fetcher as typeof fetch }))
			.rejects.toThrow('asset-activity-pagination-stalled');
		expect(fetcher).toHaveBeenCalledTimes(3);
	});

	it('scopes collection activity by recipients and can query listings only', async () => {
		const fetcher = vi.fn(async () => new Response(JSON.stringify({
			data: {
				transactions: {
					pageInfo: { hasNextPage: false },
					edges: [],
				},
			},
		}), { status: 200, headers: { 'content-type': 'application/json' } }));

		await discoverMarketActivity({
			fetch: fetcher as typeof fetch,
			recipients: [assetA, assetB],
			listingsOnly: true,
		});

		const call = fetcher.mock.calls[0] as unknown as [RequestInfo | URL, RequestInit];
		const body = JSON.parse(String(call[1].body));
		expect(body.query).toContain('recipients: $recipients');
		expect(body.variables.recipients).toEqual([assetA, assetB]);
		expect(body.variables.tags).toEqual([{ name: 'action', values: ['make-offer'] }]);
	});

	it('queries every market action when ordering verified listings by recent activity', async () => {
		const fetcher = vi.fn(async () => Response.json({
			data: { transactions: { pageInfo: { hasNextPage: false }, edges: [] } },
		}));

		await discoverMarketActivity({ fetch: fetcher as typeof fetch, recipients: [assetA] });

		const call = fetcher.mock.calls[0] as unknown as [RequestInfo | URL, RequestInit];
		const body = JSON.parse(String(call[1].body));
		expect(body.variables.recipients).toEqual([assetA]);
		expect(body.variables.tags).toEqual([{
			name: 'action',
			values: ['make-offer', 'register-interest', 'transfer', 'cancel-order'],
		}]);
	});

	it('bounds large recent-order recipient sets across two workers', async () => {
		const recipients = Array.from({ length: 205 }, (_, index) =>
			index.toString(36).padStart(43, 'A'),
		);
		let active = 0;
		let maxActive = 0;
		const batchSizes: number[] = [];
		const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
			const body = JSON.parse(String(init?.body));
			batchSizes.push(body.variables.recipients.length);
			active += 1;
			maxActive = Math.max(maxActive, active);
			await new Promise((resolve) => setTimeout(resolve, 1));
			active -= 1;
			return Response.json({
				data: { transactions: { pageInfo: { hasNextPage: false }, edges: [] } },
			});
		});
		const completed: string[][] = [];

		await discoverMarketActivityBatched({
			fetch: fetcher as typeof fetch,
			recipients,
			onBatch: (_candidates, batch) => {
				completed.push(batch);
			},
		});

		expect(batchSizes.sort((a, b) => b - a)).toEqual([100, 100, 5]);
		expect(maxActive).toBe(2);
		expect(completed.flat()).toHaveLength(205);
	});

	it('commits only completed recent-order batches when a later window fails', async () => {
		const recipients = Array.from({ length: 5 }, (_, index) =>
			index.toString(36).padStart(43, 'B'),
		);
		let request = 0;
		const fetcher = vi.fn(async () => {
			request += 1;
			if (request === 2) throw new Error('activity window unavailable');
			return Response.json({
				data: { transactions: { pageInfo: { hasNextPage: false }, edges: [] } },
			});
		});
		const completed: string[][] = [];

		await expect(discoverMarketActivityBatched({
			batchSize: 2,
			concurrency: 1,
			fetch: fetcher as typeof fetch,
			recipients,
			onBatch: (_candidates, batch) => {
				completed.push(batch);
			},
		})).rejects.toThrow('activity window unavailable');

		expect(fetcher).toHaveBeenCalledTimes(2);
		expect(completed).toEqual([recipients.slice(0, 2)]);
	});

	it('reports concurrent recent-order failures deterministically', async () => {
		const recipients = Array.from({ length: 4 }, (_, index) =>
			index.toString(36).padStart(43, 'C'),
		);
		const run = async (delays: [number, number]) => {
			let request = 0;
			const fetcher = vi.fn(async () => {
				const current = request++;
				await new Promise((resolve) => setTimeout(resolve, delays[current]));
				throw new Error(current === 0 ? 'asset-activity-graphql-429' : 'asset-activity-graphql-503');
			});
			try {
				await discoverMarketActivityBatched({
					batchSize: 2,
					concurrency: 2,
					fetch: fetcher as typeof fetch,
					recipients,
				});
				throw new Error('expected activity failure');
			} catch (cause) {
				expect(fetcher).toHaveBeenCalledTimes(2);
				return cause instanceof Error ? cause.message : String(cause);
			}
		};

		expect(await run([5, 1])).toBe(
			'asset-activity-batch-failed: asset-activity-graphql-429; asset-activity-graphql-503',
		);
		expect(await run([1, 5])).toBe(
			'asset-activity-batch-failed: asset-activity-graphql-429; asset-activity-graphql-503',
		);
	});

	it('filters a global market query against local collection membership before emitting', async () => {
		const fetcher = vi.fn(async () => Response.json({
			data: { transactions: { pageInfo: { hasNextPage: false }, edges: [
				activityEdge('current-name', nameAsset, 20),
				activityEdge('outside-name', outsideName, 19),
			] } },
		}));
		const emitted: string[][] = [];

		const candidates = await discoverMarketActivity({
			fetch: fetcher as typeof fetch,
			acceptProcessId: (processId) => Boolean(collections[1].namespace?.namesById[processId]),
			onPage: (page) => {
				emitted.push(page.map((candidate) => candidate.processId));
			},
		});

		expect(candidates.map((candidate) => candidate.processId)).toEqual([nameAsset]);
		expect(emitted).toEqual([[nameAsset]]);
		const call = fetcher.mock.calls[0] as unknown as [RequestInfo | URL, RequestInit];
		const body = JSON.parse(String(call[1].body));
		expect(body.variables.recipients).toBeNull();
	});

	it('emits each market candidate once across paginated activity', async () => {
		const pages = [
			{
				data: { transactions: { pageInfo: { hasNextPage: true }, edges: [
					activityEdge('page-1-a', assetA, 30),
					activityEdge('page-1-a-duplicate', assetA, 29),
				] } },
			},
			{
				data: { transactions: { pageInfo: { hasNextPage: false }, edges: [
					activityEdge('page-2-a', assetA, 20),
					activityEdge('page-2-b', assetB, 19),
				] } },
			},
		];
		const fetcher = vi.fn(async () => new Response(JSON.stringify(pages.shift()), {
			status: 200,
			headers: { 'content-type': 'application/json' },
		}));
		const emitted: string[][] = [];

		const result = await discoverMarketActivity({
			fetch: fetcher as typeof fetch,
			onPage: (candidates) => {
				emitted.push(candidates.map((candidate) => candidate.processId));
			},
		});

		expect(emitted).toEqual([[assetA], [assetB]]);
		expect(result.map((candidate) => candidate.processId)).toEqual([assetA, assetB]);
		expect(result[0].height).toBe(30);
	});

	it('waits for each activity page consumer before fetching the next page', async () => {
		let continueFirstPage!: () => void;
		const firstPageConsumed = new Promise<void>((resolve) => {
			continueFirstPage = resolve;
		});
		const pages = [
			{ data: { transactions: { pageInfo: { hasNextPage: true }, edges: [activityEdge('page-1', assetA, 2)] } } },
			{ data: { transactions: { pageInfo: { hasNextPage: false }, edges: [activityEdge('page-2', assetB, 1)] } } },
		];
		const fetcher = vi.fn(async () => new Response(JSON.stringify(pages.shift()), {
			status: 200,
			headers: { 'content-type': 'application/json' },
		}));
		let page = 0;
		const discovery = discoverMarketActivity({
			fetch: fetcher as typeof fetch,
			onPage: async () => {
				page += 1;
				if (page === 1) await firstPageConsumed;
			},
		});

		await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
		continueFirstPage();
		await discovery;
		expect(fetcher).toHaveBeenCalledTimes(2);
	});

	it('does not fetch another activity page after aborting a pending consumer', async () => {
		const controller = new AbortController();
		const reason = new Error('collection-changed');
		let releasePage!: () => void;
		const pagePending = new Promise<void>((resolve) => {
			releasePage = resolve;
		});
		const fetcher = vi.fn(async () => new Response(JSON.stringify({
			data: { transactions: { pageInfo: { hasNextPage: true }, edges: [activityEdge('page-1', assetA, 2)] } },
		}), { status: 200, headers: { 'content-type': 'application/json' } }));
		const discovery = discoverMarketActivity({
			fetch: fetcher as typeof fetch,
			signal: controller.signal,
			onPage: () => pagePending,
		});

		await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
		controller.abort(reason);
		releasePage();
		await expect(discovery).rejects.toBe(reason);
		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	it('returns bounded collection activity events with their actors and targets', async () => {
		const transaction = 'T'.repeat(43);
		const fetcher = vi.fn(async () => new Response(JSON.stringify({
			data: {
				transactions: {
					pageInfo: { hasNextPage: false },
					edges: [{
						cursor: 'activity-1',
						node: {
							id: transaction,
							recipient: assetA,
							owner: { address: wallet },
							tags: [
								{ name: 'action', value: 'transfer' },
								{ name: 'recipient', value: assetB },
								{ name: 'quantity', value: '7' },
							],
							block: { height: 42, timestamp: 420 },
						},
					}],
				},
			},
		}), { status: 200, headers: { 'content-type': 'application/json' } }));

		const events = await discoverCollectionActivity({
			fetch: fetcher as typeof fetch,
			recipients: [assetA, assetA, 'invalid'],
			limit: 20,
		});

		expect(events).toEqual([{
			id: transaction,
			processId: assetA,
			action: 'transfer',
			actor: wallet,
			height: 42,
			timestamp: 420,
			recipient: assetB,
			quantity: '7',
		}]);
		const call = fetcher.mock.calls[0] as unknown as [RequestInfo | URL, RequestInit];
		const body = JSON.parse(String(call[1].body));
		expect(body.variables.recipients).toEqual([assetA]);
	});

	it('bounds token collection activity and merges the newest events independent of completion order', async () => {
		const recipients = Array.from({ length: 205 }, (_, index) =>
			index.toString(36).padStart(43, 'D'),
		);
		let active = 0;
		let maxActive = 0;
		const batchSizes: number[] = [];
		const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
			const body = JSON.parse(String(init?.body));
			const batch = body.variables.recipients as string[];
			batchSizes.push(batch.length);
			active += 1;
			maxActive = Math.max(maxActive, active);
			await new Promise((resolve) => setTimeout(resolve, batch[0] === recipients[0] ? 5 : 1));
			active -= 1;
			return Response.json({
				data: { transactions: { pageInfo: { hasNextPage: false }, edges: batch.map((processId) => {
					const index = recipients.indexOf(processId);
					return activityEdge(`batch-${index}`, processId, index + 1);
				}) } },
			});
		});

		const events = await discoverCollectionActivityBatched({
			fetch: fetcher as typeof fetch,
			recipients,
			limit: 100,
		});

		expect(batchSizes.sort((a, b) => b - a)).toEqual([100, 100, 5]);
		expect(maxActive).toBe(2);
		expect(events).toHaveLength(100);
		expect(events.map((event) => event.processId)).toEqual(recipients.slice(105).reverse());
	});

	it('commits only completed token activity windows when a later batch fails', async () => {
		const recipients = Array.from({ length: 205 }, (_, index) =>
			index.toString(36).padStart(43, 'E'),
		);
		let request = 0;
		const fetcher = vi.fn(async () => {
			request += 1;
			if (request === 2) throw new Error('activity window unavailable');
			return Response.json({
				data: { transactions: { pageInfo: { hasNextPage: false }, edges: [] } },
			});
		});
		const completed: string[][] = [];

		await expect(discoverCollectionActivityBatched({
			concurrency: 1,
			fetch: fetcher as typeof fetch,
			recipients,
			onBatch: (_events, batch) => { completed.push(batch); },
		})).rejects.toThrow('activity window unavailable');

		expect(fetcher).toHaveBeenCalledTimes(2);
		expect(completed).toEqual([recipients.slice(0, 100)]);
	});

	it('queries names activity globally, filters it locally, and verifies carrier processes', async () => {
		const pages = [
			{
				data: { transactions: { pageInfo: { hasNextPage: true }, edges: [
					activityEdge('outside', outsideName, 50),
				] } },
			},
			{
				data: { transactions: { pageInfo: { hasNextPage: false }, edges: [
					activityEdge('carrier', nameAsset, 40),
					activityEdge('traditional', traditionalName, 30),
				] } },
			},
		];
		const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
			const body = JSON.parse(String(init?.body));
			if (body.query.includes('VerifyAssetProcesses')) {
				return Response.json({
					data: { transactions: { pageInfo: { hasNextPage: false }, edges: [{
						cursor: 'verified-carrier',
						node: { id: nameAsset },
					}] } },
				});
			}
			return Response.json(pages.shift());
		});
		const emitted: string[][] = [];

		const events = await discoverCollectionActivity({
			fetch: fetcher as typeof fetch,
			acceptProcessId: (processId) => Boolean(collections[1].namespace?.namesById[processId]),
			requiredExecutionDevice: 'carrier@1.0',
			onPage: (page) => {
				emitted.push(page.map((event) => event.processId));
			},
		});

		expect(events.map((event) => event.processId)).toEqual([nameAsset]);
		expect(emitted).toEqual([[], [nameAsset]]);
		const bodies = fetcher.mock.calls.map((call) => JSON.parse(String(call[1]?.body)));
		const activityBodies = bodies.filter((body) => body.query.includes('AssetMarketActivity'));
		expect(activityBodies).toHaveLength(2);
		expect(activityBodies.every((body) => body.variables.recipients === null)).toBe(true);
		const verification = bodies.find((body) => body.query.includes('VerifyAssetProcesses'));
		expect(verification.variables).toMatchObject({
			ids: [nameAsset, traditionalName],
			devices: ['carrier@1.0'],
		});
	});
});

function activityEdge(cursor: string, processId: string, height: number) {
	return {
		cursor,
		node: {
			id: cursor.padEnd(43, 'X').slice(0, 43),
			recipient: processId,
			tags: [{ name: 'action', value: 'make-offer' }],
			block: { height, timestamp: height * 10 },
		},
	};
}

describe('live candidate resolution', () => {
	it('reports failed live reads without converting them into resolved empty state', async () => {
		const candidates: AssetCandidate[] = [assetA, assetB].map((processId, index) => ({
			processId,
			height: 20 - index,
			timestamp: 0,
			sources: ['market-action'],
		}));
		const settled: Array<{ processId: string; resolved: boolean; failed: boolean }> = [];

		const results = await resolveAssetCandidates(candidates, collections, {
			read: async (processId) => {
				if (processId === assetA) throw new Error('compute-unavailable');
				return {
					provider: 'https://compute.example',
					state: parseAssetState({
						'execution-device': 'token@1.0',
						'total-supply': 1,
						balances: { [wallet]: '1' },
						orders: {},
					}),
				};
			},
			onSettled: (result, candidate, error) => settled.push({
				processId: candidate.processId,
				resolved: Boolean(result),
				failed: Boolean(error),
			}),
		});

		expect(results.map((result) => result.asset.id)).toEqual([assetB]);
		expect(settled).toEqual(expect.arrayContaining([
			{ processId: assetA, resolved: false, failed: true },
			{ processId: assetB, resolved: true, failed: false },
		]));
	});

	it('bounds live computation and excludes unsupported assets', async () => {
		let active = 0;
		let peak = 0;
		const candidates: AssetCandidate[] = [assetA, assetB, assetC].map((processId, index) => ({
			processId,
			height: 30 - index,
			timestamp: 0,
			sources: ['initial-holder'],
		}));
		const results = await resolveAssetCandidates(candidates, collections, {
			concurrency: 2,
			read: async (processId) => {
				active += 1;
				peak = Math.max(peak, active);
				await new Promise((resolve) => setTimeout(resolve, 5));
				active -= 1;
				return {
					provider: 'https://compute.example',
					state: parseAssetState({
						'execution-device': processId === assetC ? 'carrier@1.0' : 'token@1.0',
						name: processId === assetC ? 'A carrier' : '',
						'total-supply': 1,
						balances: { [wallet]: '1' },
						orders: {},
					}),
				};
			},
		});

		expect(peak).toBe(2);
		expect(results.map((result) => result.asset.id)).toEqual([assetA, assetB]);
	});

	it('uses immutable creation tags to avoid computing unsupported initial holdings', () => {
		const candidates: AssetCandidate[] = [
			{
				processId: assetA,
				height: 3,
				timestamp: 0,
				sources: ['initial-holder'],
				device: 'token@1.0',
				collection: '[TEST] Images',
			},
			{
				processId: 'U'.repeat(43),
				height: 2,
				timestamp: 0,
				sources: ['initial-holder'],
				device: 'token@1.0',
				collection: '[TEST] Unknown',
			},
			{
				processId: assetB,
				height: 1,
				timestamp: 0,
				sources: ['transfer'],
			},
		];

		expect(restrictAssetCandidates(candidates, collections).map((candidate) => candidate.processId))
			.toEqual([assetA, assetB]);
	});

	it('keeps unloaded fungible candidates and accepts them only after exact live-state verification', async () => {
		const unloaded = 'U'.repeat(43);
		const unsupported = 'V'.repeat(43);
		const withTokens: Collection[] = [
			...collections,
			{
				id: 'fungible-tokens',
				name: '[TEST] Bazar Fungible Tokens',
				description: 'Tokens',
				kind: 'tokens',
				assets: [],
			},
		];
		const candidates: AssetCandidate[] = [unloaded, unsupported].map((processId) => ({
			processId,
			height: 1,
			timestamp: 0,
			sources: ['transfer'],
		}));

		expect(restrictAssetCandidates(candidates, withTokens)).toEqual(candidates);
		const results = await resolveAssetCandidates(candidates, withTokens, {
			read: async (processId) => ({
				provider: 'https://compute.example',
				state: parseAssetState({
					device: 'process@1.0',
					'execution-device': 'token@1.0',
					'asset-type': 'fungible',
					'swap-device': 'arweave-swap@1.0',
					'scheduler-device': 'arweave-scheduler@1.0',
					'scheduler-mode': processId === unloaded ? 'all' : 'local',
					name: 'Page two token',
					ticker: 'PAGE2',
					'total-supply': '1000000000000',
					denomination: 12,
					balances: { [wallet]: '1000000000000' },
					orders: {},
				}),
			}),
		});

		expect(results).toHaveLength(1);
		expect(results[0].asset).toMatchObject({ id: unloaded, name: 'Page two token', ticker: 'PAGE2' });
		expect(results[0].collection.kind).toBe('tokens');
	});

	it('batch-rejects unindexed transfer spam before any live compute read', async () => {
		const tokenCollection: Collection = {
			id: 'fungible-tokens',
			name: 'Tokens',
			description: 'Tokens',
			kind: 'tokens',
			assets: [],
		};
		const candidates: AssetCandidate[] = Array.from({ length: 150 }, (_, index) => ({
			processId: index.toString(36).padStart(43, 'S'),
			height: index,
			timestamp: 0,
			sources: ['transfer'],
		}));
		let active = 0;
		let peak = 0;
		const batchSizes: number[] = [];
		const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
			active += 1;
			peak = Math.max(peak, active);
			batchSizes.push(JSON.parse(String(init?.body)).variables.ids.length);
			await new Promise((resolve) => setTimeout(resolve, 1));
			active -= 1;
			return Response.json({
				data: { transactions: { pageInfo: { hasNextPage: false }, edges: [] } },
			});
		});
		const read = vi.fn();

		const verification = await verifyAssetCandidateSupport(candidates, [tokenCollection], {
			fetch: fetcher as typeof fetch,
		});
		await resolveAssetCandidates(verification.supported, [tokenCollection], { read });

		expect(verification).toEqual({ supported: [], unavailable: [] });
		expect(fetcher).toHaveBeenCalledTimes(2);
		expect(Math.max(...batchSizes)).toBe(100);
		expect(peak).toBe(2);
		expect(read).not.toHaveBeenCalled();
	});

	it('retains successful verification batches when another batch is unavailable', async () => {
		const knownId = 'K'.repeat(43);
		const candidates: AssetCandidate[] = [
			{
				processId: knownId,
				height: 30,
				timestamp: 0,
				sources: ['initial-holder'],
			},
			...Array.from({ length: 19 }, (_, index) => ({
				processId: index.toString(36).padStart(43, 'U'),
				height: 20 - index,
				timestamp: 0,
				sources: ['transfer'] as AssetCandidate['sources'],
			})),
		];
		const verifiedId = candidates[10].processId;
		const tokenCollection: Collection = {
			id: 'fungible-tokens',
			name: 'Tokens',
			description: 'Tokens',
			kind: 'tokens',
			assets: [{ id: knownId, name: 'Known' }],
		};
		const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
			const ids: string[] = JSON.parse(String(init?.body)).variables.ids;
			if (ids.includes(candidates[1].processId)) return new Response('', { status: 503 });
			return Response.json({
				data: {
					transactions: {
						pageInfo: { hasNextPage: false },
						edges: ids.includes(verifiedId)
							? [{ cursor: 'verified', node: { id: verifiedId } }]
							: [],
					},
				},
			});
		});

		const verification = await verifyAssetCandidateSupport(candidates, [tokenCollection], {
			fetch: fetcher as typeof fetch,
			graphql: 'https://arweave.net/graphql',
		});

		expect(fetcher).toHaveBeenCalledTimes(3);
		expect(verification.supported.map((candidate) => candidate.processId)).toEqual([knownId, verifiedId]);
		expect(verification.unavailable.map(({ candidate }) => candidate.processId))
			.toEqual(candidates.slice(1, 10).map((candidate) => candidate.processId));
	});

	it('aborts active support workers without starting queued batches', async () => {
		const tokenCollection: Collection = {
			id: 'fungible-tokens',
			name: 'Tokens',
			description: 'Tokens',
			kind: 'tokens',
			assets: [],
		};
		const candidates: AssetCandidate[] = Array.from({ length: 19 }, (_, index) => ({
			processId: index.toString(36).padStart(43, 'A'),
			height: index,
			timestamp: 0,
			sources: ['transfer'],
		}));
		let started = 0;
		const fetcher = vi.fn((_url: string | URL | Request, init?: RequestInit) => {
			started += 1;
			return new Promise<Response>((_resolve, reject) => {
				init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
			});
		});
		const controller = new AbortController();
		const reason = new Error('support-check-stopped');
		const pending = verifyAssetCandidateSupport(candidates, [tokenCollection], {
			fetch: fetcher as typeof fetch,
			graphql: 'https://arweave.net/graphql',
			signal: controller.signal,
		});
		await vi.waitFor(() => expect(started).toBe(2));
		controller.abort(reason);

		await expect(pending).rejects.toBe(reason);
		expect(started).toBe(2);
	});

	it('partitions known assets before unrelated candidate verification', () => {
		const unknown: AssetCandidate = {
			processId: 'U'.repeat(43),
			height: 2,
			timestamp: 0,
			sources: ['transfer'],
		};
		const known: AssetCandidate = {
			processId: assetA,
			height: 1,
			timestamp: 0,
			sources: ['transfer'],
		};
		const tokenCollection: Collection = {
			id: 'fungible-tokens',
			name: 'Tokens',
			description: 'Tokens',
			kind: 'tokens',
			assets: [],
		};

		expect(partitionAssetCandidateSupport([known, unknown], [...collections, tokenCollection]))
			.toEqual({ supported: [known], unverified: [unknown] });
	});

	it('partitions a large canonical namespace without per-candidate collection scans', () => {
		const ids = Array.from({ length: 16_000 }, (_, index) => String(index).padStart(43, 'A'));
		const namesById = Object.fromEntries(ids.map((id, index) => [id, `name-${index}`]));
		const names: Collection = {
			id: 'names',
			name: 'Names',
			description: 'Names',
			kind: 'names',
			assets: [],
			namespace: { manifestId: 'M'.repeat(43), namesById },
		};
		const candidates = ids.map((processId, height) => ({
			processId,
			height,
			timestamp: height,
			sources: ['initial-holder'] as AssetCandidate['sources'],
			device: 'carrier@1.0',
		}));
		const started = performance.now();

		const result = partitionAssetCandidateSupport(candidates, [names]);

		expect(result.supported).toHaveLength(16_000);
		expect(result.unverified).toHaveLength(0);
		expect(performance.now() - started).toBeLessThan(500);
	});

	it('applies the same exact live contract to loaded token records', async () => {
		const loaded = 'L'.repeat(43);
		const tokenCollection: Collection = {
			id: 'fungible-tokens',
			name: 'Tokens',
			description: 'Tokens',
			kind: 'tokens',
			assets: [{ id: loaded, name: 'Indexed Token', ticker: 'INDEX' }],
		};
		const candidate: AssetCandidate = {
			processId: loaded,
			height: 1,
			timestamp: 0,
			sources: ['initial-holder'],
		};
		const exact = {
			device: 'process@1.0',
			'execution-device': 'token@1.0',
			'asset-type': 'fungible',
			'swap-device': 'arweave-swap@1.0',
			'scheduler-device': 'arweave-scheduler@1.0',
			'scheduler-mode': 'all',
			name: 'Live Token',
			ticker: 'LIVE',
			'total-supply': '1000000000000',
			denomination: 12,
			balances: { [wallet]: '1000000000000' },
			orders: {},
		};
		const resolve = (state: Record<string, unknown>) => resolveAssetCandidates([candidate], [tokenCollection], {
			read: async () => ({
				provider: 'https://compute.example',
				state: parseAssetState(state),
			}),
		});

		await expect(resolve(exact)).resolves.toHaveLength(1);
		for (const [key, value] of [
			['device', 'message@1.0'],
			['asset-type', 'atomic'],
			['swap-device', 'other-swap@1.0'],
			['scheduler-device', 'other-scheduler@1.0'],
			['scheduler-mode', 'local'],
		] as const) {
			await expect(resolve({ ...exact, [key]: value })).resolves.toEqual([]);
		}
	});

	it('keeps only exact namespace members among carrier and action candidates', () => {
		const candidates: AssetCandidate[] = [
			{
				processId: nameAsset,
				height: 4,
				timestamp: 0,
				sources: ['initial-holder'],
				device: 'carrier@1.0',
			},
			{
				processId: outsideName,
				height: 3,
				timestamp: 0,
				sources: ['initial-holder'],
				device: 'carrier@1.0',
			},
			{
				processId: traditionalName,
				height: 2,
				timestamp: 0,
				sources: ['market-action'],
			},
			{
				processId: 'Q'.repeat(43),
				height: 1,
				timestamp: 0,
				sources: ['market-action'],
			},
		];

		expect(restrictAssetCandidates(candidates, collections).map((candidate) => candidate.processId))
			.toEqual([nameAsset, traditionalName]);
	});

	it('requires namespace membership and a carrier state, using the manifest name', async () => {
		const candidates: AssetCandidate[] = [nameAsset, traditionalName, outsideName].map((processId, index) => ({
			processId,
			height: 3 - index,
			timestamp: 0,
			sources: ['market-action'],
		}));
		const results = await resolveAssetCandidates(candidates, collections, {
			read: async (processId) => ({
				provider: 'https://compute.example',
				state: parseAssetState({
					'execution-device': processId === traditionalName ? 'token@1.0' : 'carrier@1.0',
					name: 'untrusted-live-name',
					'total-supply': 1,
					balances: { [wallet]: '1' },
					orders: {},
				}),
			}),
		});

		expect(results).toHaveLength(1);
		expect(results[0].asset).toEqual({ id: nameAsset, name: 'canonical-name' });
		expect(results[0].collection.kind).toBe('names');
	});

	it('groups only current live ownership and active listings', () => {
		const candidate: AssetCandidate = {
			processId: assetA,
			height: 1,
			timestamp: 1,
			sources: ['market-action'],
		};
		const result = {
			asset: collections[0].assets[0],
			collection: collections[0],
			provider: 'https://compute.example',
			activity: candidate,
			state: parseAssetState({
				'execution-device': 'token@1.0',
				'total-supply': 1,
				balances: {},
				orders: {
					[orderId]: {
						'order-id': orderId,
						creator: wallet,
						recipient: wallet,
						asking: '100000000',
						deposit: '0',
						'minimum-fee': '100000000',
						deadline: 20,
						'created-at': 1,
						quantity: 1,
						status: 'open',
					},
				},
			}),
		};

		expect(walletAssetGroup(result, wallet)).toBe('listed');
		expect(walletAssetGroup(result, buyer)).toBeNull();
		expect(walletAssetGroup({
			...result,
			state: parseAssetState({
				'execution-device': 'token@1.0',
				'total-supply': 1,
				balances: { [wallet]: '1' },
				orders: {},
			}),
		}, wallet)).toBe('owned');
	});
});
