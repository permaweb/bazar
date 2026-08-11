import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_COMPUTE_GATEWAY } from 'helpers/config';

import {
	bestAskOfAsset,
	compareOrderUnitPrice,
	licenseProperties,
	liquidBalanceOf,
	listedBalanceOf,
	liveOrdersOfAsset,
	ownerOfAsset,
	parseAssetState,
	readAssetState,
	readAssetStateAtSlot,
	readProcessAssignments,
	servingNodeOrigin,
	servingNodeOrigins,
	type SwapOrder,
	waitForAssetState,
} from './asset-marketplace';

const owner = '1uTLV5GvfQ5M46Tq_DTeJL7rIy7vCAOMxQ7Fbf82YZw';
const buyer = 'BLyLiOZptmb-olB8wycvk_ynHiu1SZMKPqswx4KONwc';
const orderId = 'qAhWNMSuX70lZpIRohKJn_SuVcymr_RmpGbltydjpwA';

function assignment(slot: number, transactionId: string) {
	return {
		'block-height': 1_972_540,
		body: {
			commitments: {
				[transactionId]: { 'commitment-device': 'tx@1.0' },
			},
		},
		process: 'IyFfmbTu8P4rv0KyrA0Q-QtfEnYntMj4RkRiBVip9KA',
		slot,
	};
}

describe('servingNodeOrigin', () => {
	it('uses the default compute gateway unless an explicit node is selected', () => {
		expect(servingNodeOrigin({ protocol: 'http:', hostname: '127.0.0.1', port: '3000' })).toBe(
			DEFAULT_COMPUTE_GATEWAY
		);
		expect(
			servingNodeOrigin({
				protocol: 'http:',
				hostname: '127.0.0.1',
				port: '3000',
				search: '?node=http%3A%2F%2F127.0.0.1%3A3101',
			})
		).toBe('http://127.0.0.1:3101');
	});

	it('keeps every selected compute peer in order', () => {
		expect(
			servingNodeOrigins({
				protocol: 'https:',
				hostname: 'bazar.example',
				search: `?node=${encodeURIComponent('https://alpha.example,https://charlie.example')}`,
			})
		).toEqual(['https://alpha.example', 'https://charlie.example']);
	});

	it('uses the default gateway instead of the site hosting origin', () => {
		expect(servingNodeOrigin({ protocol: 'https:', hostname: 'arweave.net' })).toBe(DEFAULT_COMPUTE_GATEWAY);
	});
});

describe('asset state', () => {
	it('parses one-unit token state and finds the direct owner', () => {
		const state = parseAssetState({
			'execution-device': 'token@1.0',
			name: 'Permanent Strata #001',
			'total-supply': 1,
			balances: { [owner]: '1' },
			orders: {},
		});
		expect(state.name).toBe('Permanent Strata #001');
		expect(state.totalSupply).toBe('1');
		expect(state.denomination).toBe(0);
		expect(state.ticker).toBe('');
		expect(ownerOfAsset(state)).toBe(owner);
	});

	it('keeps the seller as owner while the unit is escrowed', () => {
		const state = parseAssetState({
			'execution-device': 'token@1.0',
			'total-supply': '1',
			balances: {},
			orders: {
				[orderId]: {
					'order-id': orderId,
					creator: owner,
					recipient: owner,
					asking: '100000000',
					'minimum-fee': '100000000',
					deadline: 20,
					'created-at': 1,
					quantity: 1,
					status: 'reserved',
					buyer,
				},
			},
		});
		expect(ownerOfAsset(state)).toBe(owner);
		expect(state.orders[orderId].buyer).toBe(buyer);
	});

	it('preserves fungible amounts above MAX_SAFE_INTEGER and parses token metadata', () => {
		const state = parseAssetState({
			'execution-device': 'token@1.0',
			name: 'Fungible test token',
			ticker: 'FTT',
			denomination: '12',
			'total-supply': '900719925474099312345678',
			balances: { [owner]: '900719925474099312345678' },
			orders: {
				[orderId]: order(orderId, { quantity: '900719925474099312345' }),
			},
		});
		expect(state.totalSupply).toBe('900719925474099312345678');
		expect(state.balances[owner]).toBe('900719925474099312345678');
		expect(state.denomination).toBe(12);
		expect(state.ticker).toBe('FTT');
		expect(state.orders[orderId].quantity).toBe('900719925474099312345');
		expect(ownerOfAsset(state)).toBeNull();
	});

	it('preserves unsafe integer lexemes from live HyperBEAM JSON responses', async () => {
		const processId = 'IyFfmbTu8P4rv0KyrA0Q-QtfEnYntMj4RkRiBVip9KA';
		const responseBody = `{"execution-device":"token@1.0","denomination":12,"ticker":"WEAVE","total-supply":1000000000000000000,"balances":{"${owner}":999997000000000001},"orders":{}}`;
		let requested = '';
		const result = await readAssetState(processId, {
			maxAge: 0,
			fetch: async (input) => {
				requested = String(input);
				return new Response(responseBody, {
					status: 200,
					headers: { 'content-type': 'application/json' },
				});
			},
		});
		const { state } = result;
		expect(state.totalSupply).toBe('1000000000000000000');
		expect(state.balances[owner]).toBe('999997000000000001');
		expect(requested).toContain('now&max-age=0');
		expect(result.maxAge).toBe(0);
		expect(result.verifiedAt).toBeGreaterThan(0);
	});

	it('pins background observation to the operation compute gateway', async () => {
		const processId = 'IyFfmbTu8P4rv0KyrA0Q-QtfEnYntMj4RkRiBVip9KA';
		let requested = '';
		const result = await readAssetState(processId, {
			provider: 'https://original-compute.example',
			fetch: async (input) => {
				requested = String(input);
				return Response.json({
					'execution-device': 'token@1.0',
					'total-supply': '1',
					balances: { [owner]: '1' },
					orders: {},
				});
			},
		});

		expect(requested).toMatch(/^https:\/\/original-compute\.example\//);
		expect(result.provider).toBe('https://original-compute.example');
	});

	it('preserves the requested freshness when the preferred codec falls back', async () => {
		const processId = 'IyFfmbTu8P4rv0KyrA0Q-QtfEnYntMj4RkRiBVip9KA';
		const requested: string[] = [];
		await readAssetState(processId, {
			maxAge: 0,
			fetch: async (input) => {
				requested.push(String(input));
				if (requested.length === 1) return new Response('unsupported codec', { status: 415 });
				return new Response(
					JSON.stringify({
						'execution-device': 'token@1.0',
						'total-supply': '1',
						balances: { [owner]: '1' },
						orders: {},
					}),
					{ status: 200 }
				);
			},
		});

		expect(requested).toHaveLength(2);
		expect(requested[0]).toContain('now&max-age=0');
		expect(requested[1]).toContain('now&max-age=0');
		expect(requested[1]).toContain('require-codec=application%2Fjson');
	});

	it('bypasses cached process state throughout transaction acceptance polling', async () => {
		const processId = 'IyFfmbTu8P4rv0KyrA0Q-QtfEnYntMj4RkRiBVip9KA';
		const requested: string[] = [];
		const requestOptions: RequestInit[] = [];
		const result = await waitForAssetState(processId, (state) => state.balances[owner] === '1', {
			fetch: async (input, init) => {
				requested.push(String(input));
				requestOptions.push(init ?? {});
				if (requested.length === 1) return new Response('unsupported codec', { status: 415 });
				return Response.json({
					'execution-device': 'token@1.0',
					'total-supply': '1',
					balances: { [owner]: '1' },
					orders: {},
				});
			},
		});

		expect(requested).toHaveLength(2);
		expect(requested.every((url) => url.includes('now&max-age=0'))).toBe(true);
		expect(requestOptions.every((options) => options.cache === 'no-store')).toBe(true);
		expect(result.maxAge).toBe(0);
	});

	it('reads one exact historical state and rejects a mismatched slot', async () => {
		const processId = 'IyFfmbTu8P4rv0KyrA0Q-QtfEnYntMj4RkRiBVip9KA';
		const requested: string[] = [];
		const fetcher = async (input: RequestInfo | URL) => {
			requested.push(String(input));
			return new Response(
				JSON.stringify({
					'execution-device': 'token@1.0',
					'at-slot': 18,
					'total-supply': '1',
					balances: { [owner]: '1' },
					orders: {},
				})
			);
		};

		await expect(readAssetStateAtSlot(processId, 18, { fetch: fetcher as typeof fetch })).resolves.toMatchObject({
			state: { raw: { 'at-slot': 18 } },
			maxAge: 0,
		});
		expect(requested[0]).toContain('compute?slot=18&require-codec=json%401.0');
		await expect(readAssetStateAtSlot(processId, 17, { fetch: fetcher as typeof fetch })).rejects.toThrow(
			'historical-state-slot-mismatch'
		);
	});

	it('reads a complete schedule window and extracts exact signed transaction IDs', async () => {
		const processId = 'IyFfmbTu8P4rv0KyrA0Q-QtfEnYntMj4RkRiBVip9KA';
		const transactionId = 'T'.repeat(43);
		let requested = '';
		const assignments = await readProcessAssignments(processId, 8, 9, {
			fetch: async (input) => {
				requested = String(input);
				return new Response(
					JSON.stringify({
						8: assignment(8, 'A'.repeat(43)),
						9: assignment(9, transactionId),
						status: 200,
					})
				);
			},
		});

		expect(requested).toContain('schedule&from=8&to=9/assignments');
		expect(assignments.map((held) => held.slot)).toEqual([8, 9]);
		expect(assignments[1].transactionIds).toEqual([transactionId]);
	});

	it('rejects an incomplete schedule window instead of skipping a transaction', async () => {
		await expect(
			readProcessAssignments('R'.repeat(43), 8, 9, {
				fetch: async () => new Response(JSON.stringify({ 8: assignment(8, 'A'.repeat(43)) })),
			})
		).rejects.toThrow('incomplete-process-schedule');
	});

	it('retries a rate limit without multiplying it across codec fallbacks', async () => {
		const requested: string[] = [];
		const fetcher = vi.fn(async (input: RequestInfo | URL) => {
			requested.push(String(input));
			if (requested.length === 1) {
				return new Response('rate limited', { status: 429, headers: { 'retry-after': '0' } });
			}
			return Response.json({
				'execution-device': 'token@1.0',
				'total-supply': '1',
				balances: { [owner]: '1' },
				orders: {},
			});
		});

		await expect(readAssetState('R'.repeat(43), { fetch: fetcher as typeof fetch })).resolves.toBeDefined();
		expect(requested).toHaveLength(2);
		expect(requested[1]).toBe(requested[0]);
	});

	it('rejects unsafe token metadata', () => {
		const base = {
			'execution-device': 'token@1.0',
			'total-supply': '2',
			balances: { [owner]: '2' },
		};
		expect(() => parseAssetState({ ...base, denomination: 256 })).toThrow('invalid-asset-state');
		expect(() => parseAssetState({ ...base, ticker: ' bad ' })).toThrow('invalid-asset-state');
	});

	it('reports liquid and escrowed balances and sorts all live asks exactly', () => {
		const cheaperId = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
		const olderTieId = 'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB';
		const newerTieId = 'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC';
		const state = parseAssetState({
			'execution-device': 'token@1.0',
			'total-supply': '100000000000000000000',
			balances: { [owner]: '90000000000000000000' },
			orders: {
				[olderTieId]: order(olderTieId, { asking: '6', quantity: '4', 'created-at': 1 }),
				[newerTieId]: order(newerTieId, { asking: '3', quantity: '2', 'created-at': 2 }),
				[cheaperId]: order(cheaperId, { asking: '1', quantity: '1' }),
				[orderId]: order(orderId, { asking: '2', quantity: '1', status: 'cancelled' }),
			},
		});

		expect(liquidBalanceOf(state, owner)).toBe('90000000000000000000');
		expect(listedBalanceOf(state, owner)).toBe('7');
		expect(liveOrdersOfAsset(state).map((held) => held.orderId)).toEqual([cheaperId, olderTieId, newerTieId]);
		expect(bestAskOfAsset(state)?.orderId).toBe(cheaperId);
		expect(compareOrderUnitPrice(state.orders[olderTieId], state.orders[newerTieId])).toBeLessThan(0);
	});

	it('renders only declared scalar license properties', () => {
		const state = parseAssetState({
			'execution-device': 'token@1.0',
			'total-supply': 1,
			balances: { [owner]: 1 },
			license: 'dE0rmDfl9_OWjkDznNEXHaSO_JohJkRolvMzaCroUdw',
			commercial_use: true,
			'access-fee': 12,
			ignored: { inferred: false },
		});
		expect(licenseProperties(state)).toEqual([
			{ key: 'license', label: 'License', value: 'Universal Data License' },
			{ key: 'access-fee', label: 'Access fee', value: '12' },
			{ key: 'commercial-use', label: 'Commercial use', value: 'true' },
		]);
	});
});

function order(id: string, overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
	return {
		'order-id': id,
		creator: owner,
		recipient: owner,
		asking: '100000000',
		'minimum-fee': '100000000',
		deadline: 20,
		'created-at': 1,
		quantity: '1',
		status: 'open',
		...overrides,
	};
}
