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
const processId = 'IyFfmbTu8P4rv0KyrA0Q-QtfEnYntMj4RkRiBVip9KA';

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

function jsonResponse(value: unknown, init: ResponseInit = {}): Response {
	const headers = new Headers(init.headers);
	headers.set('content-type', 'application/json');
	headers.set('codec-device', 'json@1.0');
	return new Response(typeof value === 'string' ? value : JSON.stringify(value), { ...init, headers });
}

function httpsigHeaderName(name: string): string {
	return [...name]
		.map((character) =>
			/[A-Z]/.test(character) ? `%${character.charCodeAt(0).toString(16).toUpperCase()}` : character
		)
		.join('');
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
				return jsonResponse(responseBody);
			},
		});
		const { state } = result;
		expect(state.totalSupply).toBe('1000000000000000000');
		expect(state.balances[owner]).toBe('999997000000000001');
		expect(requested).toContain('/now');
		expect(result.maxAge).toBe(0);
		expect(result.verifiedAt).toBeGreaterThan(0);
	});

	it('projects binary data out of process state and resolves linked tables independently', async () => {
		const balancesLink = 'B'.repeat(43);
		const ordersLink = 'O'.repeat(43);
		const requests: Array<{ url: string; headers: Headers }> = [];
		const result = await readAssetState(processId, {
			provider: 'https://compute.example',
			fetch: async (input, init) => {
				const url = String(input);
				requests.push({ url, headers: new Headers(init?.headers) });
				if (url.includes(balancesLink)) {
					return jsonResponse(`{"${owner}":999997000000000001,"status":200}`);
				}
				if (url.includes(ordersLink)) {
					return jsonResponse({ [orderId]: order(orderId), status: 200 });
				}
				return jsonResponse({
					'execution-device': 'token@1.0',
					'total-supply': '1000000000000000000',
					'balances+link': balancesLink,
					'orders+link': ordersLink,
				});
			},
		});

		expect(result.state.balances).toEqual({ [owner]: '999997000000000001' });
		expect(result.state.orders[orderId]).toMatchObject({ orderId, creator: owner });
		expect(result.state.raw).toMatchObject({
			'balances+link': balancesLink,
			'orders+link': ordersLink,
		});
		expect(requests).toHaveLength(3);
		expect(requests[0].url).toContain('/compute&max-age=60');
		expect(requests.every(({ headers }) => [...headers].length === 0)).toBe(true);
		expect(requests.slice(1).every(({ headers }) => headers.get('accept-bundle') === null)).toBe(true);
		expect(requests.slice(1).every(({ headers }) => headers.get('require-codec') === null)).toBe(true);
		expect(requests.slice(1).every(({ headers }) => headers.get('cache-control') === null)).toBe(true);
	});

	it('reads ordinary HTTPSig headers and walks a 1,000-owner linked trie without codec parameters', async () => {
		const rootId = 'R'.repeat(43);
		const prefixes = 'abcdefghij';
		const childIds = new Map([...prefixes].map((prefix, index) => [prefix, String(index).repeat(43)]));
		const requests: Array<{ url: string; init: RequestInit }> = [];
		const expected = Object.fromEntries(
			[...prefixes].flatMap((prefix) =>
				Array.from({ length: 100 }, (_, index) => [`${prefix}${index.toString(36).padStart(42, '0')}`, '1'])
			)
		);

		const result = await readAssetState(processId, {
			provider: 'https://compute.example',
			fetch: async (input, init = {}) => {
				const url = String(input);
				requests.push({ url, init });
				if (url.endsWith(rootId)) {
					return new Response(null, {
						headers: Object.fromEntries([
							['device', 'trie@1.0'],
							...[...childIds].map(([prefix, id]) => [`${prefix}+link`, id]),
						]),
					});
				}
				const child = [...childIds].find(([, id]) => url.endsWith(id));
				if (child) {
					const [prefix] = child;
					return new Response(null, {
						headers: Object.fromEntries(
							Object.keys(expected)
								.filter((address) => address.startsWith(prefix))
								.map((address) => [address.slice(1), '1'])
						),
					});
				}
				return new Response(null, {
					headers: {
						'ao-body-key': 'data',
						'balances+link': rootId,
						device: 'process@1.0',
						'execution-device': 'token@1.0',
						'total-supply': '1000',
					},
				});
			},
		});

		expect(result.state.balances).toEqual(expected);
		expect(Object.keys(result.state.balances)).toHaveLength(1000);
		expect(requests).toHaveLength(12);
		expect(requests.every(({ url }) => !url.includes('?'))).toBe(true);
		expect(requests.every(({ init }) => init.method === 'HEAD')).toBe(true);
		expect(requests.every(({ init }) => [...new Headers(init.headers)].length === 0)).toBe(true);
	});

	it('restores escaped mixed-case HTTPSig field names', async () => {
		const balancesLink = 'B'.repeat(43);
		const result = await readAssetState(processId, {
			provider: 'https://compute.example',
			fetch: async (input) =>
				String(input).endsWith(balancesLink)
					? new Response(null, { headers: { [httpsigHeaderName(owner)]: '1' } })
					: new Response(null, {
							headers: {
								'balances+link': balancesLink,
								'execution-device': 'token@1.0',
								'total-supply': '1',
							},
					  }),
		});

		expect(result.state.balances).toEqual({ [owner]: '1' });
	});

	it('reads an order status through the message device when HTTP status shadows its header', async () => {
		const balancesLink = 'B'.repeat(43);
		const ordersLink = 'O'.repeat(43);
		const orderLink = 'L'.repeat(43);
		const requested: string[] = [];
		const result = await readAssetState(processId, {
			provider: 'https://compute.example',
			fetch: async (input) => {
				const url = String(input);
				requested.push(url);
				if (url.endsWith(`${orderLink}~message@1.0/status`)) return new Response('open');
				if (url.endsWith(orderLink)) {
					return new Response(null, {
						headers: Object.fromEntries(
							Object.entries({ ...order(orderId), status: '200' }).map(([name, value]) => [
								name,
								String(value),
							])
						),
					});
				}
				if (url.endsWith(ordersLink)) {
					return new Response(null, { headers: { [`${orderId.toLowerCase()}+link`]: orderLink } });
				}
				if (url.endsWith(balancesLink)) {
					return new Response(null, { headers: { [httpsigHeaderName(owner)]: '1' } });
				}
				return new Response(null, {
					headers: {
						'balances+link': balancesLink,
						'execution-device': 'token@1.0',
						'orders+link': ordersLink,
						'total-supply': '1',
					},
				});
			},
		});

		expect(result.state.orders[orderId]).toMatchObject({ orderId, status: 'open' });
		expect(requested).toContain(`https://compute.example/${orderLink}~message@1.0/status`);
		expect(requested.every((url) => !url.includes('require-codec'))).toBe(true);
	});

	it('pins background observation to the operation compute gateway', async () => {
		const processId = 'IyFfmbTu8P4rv0KyrA0Q-QtfEnYntMj4RkRiBVip9KA';
		let requested = '';
		const result = await readAssetState(processId, {
			provider: 'https://original-compute.example',
			fetch: async (input) => {
				requested = String(input);
				return jsonResponse({
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

	it('uses one unqualified HTTPSig HEAD request for current state', async () => {
		const processId = 'IyFfmbTu8P4rv0KyrA0Q-QtfEnYntMj4RkRiBVip9KA';
		const requested: string[] = [];
		const requestOptions: RequestInit[] = [];
		await readAssetState(processId, {
			maxAge: 0,
			fetch: async (input, init) => {
				requested.push(String(input));
				requestOptions.push(init ?? {});
				return jsonResponse({
					'execution-device': 'token@1.0',
					'total-supply': '1',
					balances: { [owner]: '1' },
					orders: {},
				});
			},
		});

		expect(requested).toEqual([`https://arweave.net/${processId}~process@1.0/now`]);
		expect(requestOptions[0].method).toBe('HEAD');
		expect([...new Headers(requestOptions[0].headers)]).toEqual([]);
	});

	it('expresses passive freshness in the AO path without request headers', async () => {
		let requested = '';
		const requestOptions: RequestInit[] = [];
		await readAssetState('IyFfmbTu8P4rv0KyrA0Q-QtfEnYntMj4RkRiBVip9KA', {
			maxAge: 60,
			fetch: async (input, init) => {
				requested = String(input);
				requestOptions.push(init ?? {});
				return jsonResponse({
					'execution-device': 'token@1.0',
					'total-supply': '1',
					balances: { [owner]: '1' },
					orders: {},
				});
			},
		});

		expect(requested).toContain('compute&max-age=60');
		expect(requestOptions[0].cache).toBeUndefined();
		expect(requestOptions[0].method).toBe('HEAD');
		expect([...new Headers(requestOptions[0].headers)]).toEqual([]);
	});

	it('reports the peer that returned the routed process state', async () => {
		vi.stubGlobal('window', {
			location: {
				protocol: 'https:',
				hostname: 'bazar.example',
				port: '',
				search: `?node=${encodeURIComponent('https://alpha.example,https://charlie.example')}`,
				hash: '',
			},
		});
		try {
			const result = await readAssetState('IyFfmbTu8P4rv0KyrA0Q-QtfEnYntMj4RkRiBVip9KA', {
				maxAge: 60,
				fetch: async (input) => {
					if (String(input).startsWith('https://alpha.example/')) {
						return new Response('unavailable', { status: 502 });
					}
					const response = jsonResponse({
						'execution-device': 'token@1.0',
						'total-supply': '1',
						balances: { [owner]: '1' },
						orders: {},
					});
					Object.defineProperty(response, 'url', { value: 'https://charlie.example/state' });
					return response;
				},
			});

			expect(result.provider).toBe('https://charlie.example');
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it('rejects malformed HTTPSig headers without a codec fallback', async () => {
		let requests = 0;
		await expect(
			readAssetState('IyFfmbTu8P4rv0KyrA0Q-QtfEnYntMj4RkRiBVip9KA', {
				maxAge: 60,
				fetch: async () => {
					requests += 1;
					return new Response(null, { headers: { name: 'incomplete' } });
				},
			})
		).rejects.toThrow('invalid-asset-state');
		expect(requests).toBe(1);
	});

	it('bypasses cached process state throughout transaction acceptance polling', async () => {
		const processId = 'IyFfmbTu8P4rv0KyrA0Q-QtfEnYntMj4RkRiBVip9KA';
		const requested: string[] = [];
		const requestOptions: RequestInit[] = [];
		const result = await waitForAssetState(processId, (state) => state.balances[owner] === '1', {
			fetch: async (input, init) => {
				requested.push(String(input));
				requestOptions.push(init ?? {});
				return jsonResponse({
					'execution-device': 'token@1.0',
					'total-supply': '1',
					balances: { [owner]: '1' },
					orders: {},
				});
			},
		});

		expect(requested).toEqual([`https://arweave.net/${processId}~process@1.0/now`]);
		expect(requestOptions.every((options) => options.cache === undefined)).toBe(true);
		expect(requestOptions.every((options) => options.method === 'HEAD')).toBe(true);
		expect(requestOptions.every((options) => [...new Headers(options.headers)].length === 0)).toBe(true);
		expect(result.maxAge).toBe(0);
	});

	it('does not send browser cache policy to the HyperBEAM node', async () => {
		const requestOptions: RequestInit[] = [];
		await readAssetState('IyFfmbTu8P4rv0KyrA0Q-QtfEnYntMj4RkRiBVip9KA', {
			maxAge: 0,
			staleWhileRevalidate: 86_400,
			fetch: async (_input, init) => {
				requestOptions.push(init ?? {});
				return jsonResponse({
					'execution-device': 'token@1.0',
					'total-supply': '1',
					balances: { [owner]: '1' },
					orders: {},
				});
			},
		});

		expect(requestOptions[0].cache).toBeUndefined();
		expect(requestOptions[0].method).toBe('HEAD');
		expect([...new Headers(requestOptions[0].headers)]).toEqual([]);
	});

	it('reads one exact historical state and rejects a mismatched slot', async () => {
		const processId = 'IyFfmbTu8P4rv0KyrA0Q-QtfEnYntMj4RkRiBVip9KA';
		const requested: string[] = [];
		const requestOptions: RequestInit[] = [];
		const fetcher = async (input: RequestInfo | URL, init?: RequestInit) => {
			requested.push(String(input));
			requestOptions.push(init ?? {});
			return jsonResponse({
				'execution-device': 'token@1.0',
				'at-slot': 18,
				'total-supply': '1',
				balances: { [owner]: '1' },
				orders: {},
			});
		};

		await expect(readAssetStateAtSlot(processId, 18, { fetch: fetcher as typeof fetch })).resolves.toMatchObject({
			state: { raw: { 'at-slot': 18 } },
			maxAge: 0,
		});
		expect(requested[0]).toContain('compute&slot=18');
		expect(requestOptions[0].cache).toBeUndefined();
		expect(requestOptions[0].method).toBe('HEAD');
		expect([...new Headers(requestOptions[0].headers)]).toEqual([]);
		await readAssetStateAtSlot(processId, 18, { fetch: fetcher as typeof fetch });
		expect(requested).toHaveLength(2);
		await expect(readAssetStateAtSlot(processId, 17, { fetch: fetcher as typeof fetch })).rejects.toThrow(
			'historical-state-slot-mismatch'
		);
	});

	it('replaces passive current state after a strict read', async () => {
		let calls = 0;
		let balance = '1';
		vi.stubGlobal('caches', memoryCacheStorage());
		const fetcher = async () => {
			calls += 1;
			return jsonResponse({
				'execution-device': 'token@1.0',
				'total-supply': '1',
				balances: { [owner]: balance },
				orders: {},
			});
		};
		try {
			const passive = await readAssetState(processId, { fetch: fetcher as typeof fetch, maxAge: 60 });
			balance = '2';
			const strict = await readAssetState(processId, { fetch: fetcher as typeof fetch, maxAge: 0 });
			const restored = await readAssetState(processId, { fetch: fetcher as typeof fetch, maxAge: 60 });

			expect(passive.state.balances[owner]).toBe('1');
			expect(strict.state.balances[owner]).toBe('2');
			expect(restored.state.balances[owner]).toBe('2');
			expect(calls).toBe(3);
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it('does not persist HEAD state responses in the browser body cache', async () => {
		let calls = 0;
		const fetcher = async () => {
			calls += 1;
			return jsonResponse({
				'execution-device': 'token@1.0',
				'total-supply': '1',
				balances: { [owner]: String(calls) },
				orders: {},
			});
		};
		const first = await readAssetState(processId, { fetch: fetcher as typeof fetch, maxAge: 30 });
		const second = await readAssetState(processId, { fetch: fetcher as typeof fetch, maxAge: 30 });

		expect(first.state.balances[owner]).toBe('1');
		expect(second.state.balances[owner]).toBe('2');
		expect(second.revalidation).toBeUndefined();
		expect(calls).toBe(2);
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

	it('retries a rate limit without multiplying the plain state request', async () => {
		const requested: string[] = [];
		const fetcher = vi.fn(async (input: RequestInfo | URL) => {
			requested.push(String(input));
			if (requested.length === 1) {
				return new Response('rate limited', { status: 429, headers: { 'retry-after': '0' } });
			}
			return jsonResponse({
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
			{ key: 'license', label: 'License', value: 'Universal Data License 0.2' },
			{ key: 'access-fee', label: 'Access fee', value: '12' },
			{ key: 'derivation', label: 'Derivatives', value: 'Non-commercial only' },
			{ key: 'unknown-usage-rights', label: 'Unknown usage rights', value: 'Included where available' },
			{ key: 'commercial-use', label: 'Commercial use', value: 'true' },
			{ key: 'data-model-training', label: 'AI model training', value: 'Not allowed' },
			{ key: 'expiry', label: 'License term', value: 'Unlimited' },
			{ key: 'currency', label: 'Currency', value: '$U' },
		]);
	});

	it('shows the effective defaults of a license-only UDL asset', () => {
		const state = parseAssetState({
			'execution-device': 'token@1.0',
			'total-supply': 1,
			balances: { [owner]: 1 },
			license: 'dE0rmDfl9_OWjkDznNEXHaSO_JohJkRolvMzaCroUdw',
		});

		expect(licenseProperties(state)).toEqual([
			{ key: 'license', label: 'License', value: 'Universal Data License 0.2' },
			{ key: 'access', label: 'Access', value: 'Free' },
			{ key: 'derivation', label: 'Derivatives', value: 'Non-commercial only' },
			{ key: 'unknown-usage-rights', label: 'Unknown usage rights', value: 'Included where available' },
			{ key: 'commercial-use', label: 'Commercial use', value: 'Not allowed' },
			{ key: 'data-model-training', label: 'AI model training', value: 'Not allowed' },
			{ key: 'expiry', label: 'License term', value: 'Unlimited' },
			{ key: 'currency', label: 'Currency', value: '$U' },
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

function memoryCacheStorage(): CacheStorage {
	const held = new Map<string, Response>();
	const cache = {
		async delete(input: RequestInfo | URL) {
			return held.delete(String(input));
		},
		async keys() {
			return [...held.keys()].map((key) => new Request(key));
		},
		async match(input: RequestInfo | URL) {
			return held.get(String(input))?.clone();
		},
		async put(input: RequestInfo | URL, response: Response) {
			held.set(String(input), response.clone());
		},
	} as unknown as Cache;
	return { open: async () => cache } as unknown as CacheStorage;
}
