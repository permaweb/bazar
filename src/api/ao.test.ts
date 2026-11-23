import { afterEach, describe, expect, it, vi } from 'vitest';

import {
	aoRoutingScopeFromLocation,
	type EffectivePermawebNetworkPolicy,
	observerRelayFromLocation,
	permanentContentGatewayFromLocation,
	prefersPermawebOsAo,
	setAoWalletConnection,
} from 'helpers/config';

import {
	AO_READ_HEDGE_AFTER_MS,
	AO_REQUEST_TIMEOUT_MS,
	aoFetch,
	aoPeers,
	aoPrimaryPeer,
	createBazarAoFetch,
	probeServingOriginCompute,
	readyAoFetch,
	warmAoFetch,
} from './ao';
import { readAssetState } from './asset-marketplace';

function injectedAoFetch(peers: string[]): PermawebOsAoFetch {
	const fetcher = vi.fn(async () => new Response('from-permawebos')) as unknown as PermawebOsAoFetch;
	fetcher.invalidate = vi.fn(async () => undefined);
	fetcher.cacheMetadata = vi.fn(() => undefined);
	Object.defineProperty(fetcher, 'peers', { value: peers });
	fetcher.ready = vi.fn(async () => peers);
	return fetcher;
}

afterEach(() => vi.unstubAllGlobals());

function browserWindow(aoFetch?: PermawebOsAoFetch, search = '', connected = true) {
	const wallet = { connect: vi.fn(), sign: vi.fn() };
	const scope = Object.assign(new EventTarget(), {
		permawebConnect: wallet,
		arweaveWallet: wallet,
		...(aoFetch ? { aoFetch } : {}),
		location: {
			protocol: 'https:',
			hostname: 'bazar.example',
			port: '',
			search,
			hash: '',
		},
	});
	if (connected) setAoWalletConnection('a'.repeat(43), scope);
	return scope;
}

describe('PermawebOS AO transport boundary', () => {
	it.each(['disconnected', 'wander', 'local'] as const)(
		'loads public state through Bazar with routing enabled and a %s wallet',
		async (session) => {
			const permawebOs = injectedAoFetch(['https://permawebos.example']);
			vi.mocked(permawebOs).mockRejectedValue(new Error('Wallet is not connected'));
			const scope = browserWindow(permawebOs, `?node=https://${session}.example`, false);
			if (session !== 'disconnected') {
				scope.arweaveWallet = { connect: vi.fn(), sign: vi.fn() };
				setAoWalletConnection('b'.repeat(43), scope);
			}
			vi.stubGlobal('window', scope);
			const nativeFetch = vi.fn(async () => new Response('collection-state'));
			vi.stubGlobal('fetch', nativeFetch);

			expect(prefersPermawebOsAo()).toBe(true);
			expect(aoPeers()).toEqual([`https://${session}.example`]);
			const response = await aoFetch()('/collection~process@1.0/now');
			expect(await response.text()).toBe('collection-state');
			expect(permawebOs).not.toHaveBeenCalled();
			expect(nativeFetch).toHaveBeenCalled();
		}
	);

	it('notifies collection readers when the active wallet connects, switches, or disconnects', async () => {
		const permawebOs = injectedAoFetch(['https://permawebos.example']);
		const scope = browserWindow(permawebOs, '?node=https://session.example', false);
		vi.stubGlobal('window', scope);
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response('ok'))
		);
		const changed = vi.fn();
		const stop = warmAoFetch(changed);

		setAoWalletConnection('a'.repeat(43));
		expect(changed).toHaveBeenCalledOnce();
		expect(aoFetch()).toBe(permawebOs);
		setAoWalletConnection('a'.repeat(43));
		expect(changed).toHaveBeenCalledOnce();

		scope.arweaveWallet = { connect: vi.fn(), sign: vi.fn() };
		setAoWalletConnection('b'.repeat(43));
		expect(changed).toHaveBeenCalledTimes(2);
		expect(aoPeers()).toEqual(['https://session.example']);

		scope.arweaveWallet = scope.permawebConnect;
		setAoWalletConnection('a'.repeat(43));
		setAoWalletConnection(null);
		expect(changed).toHaveBeenCalledTimes(4);
		expect(aoFetch()).not.toBe(permawebOs);
		expect(prefersPermawebOsAo()).toBe(true);
		stop();
		setAoWalletConnection('a'.repeat(43));
		expect(changed).toHaveBeenCalledTimes(4);
	});

	it('returns the exact injected singleton and reads its active peers', async () => {
		const permawebOs = injectedAoFetch(['https://primary.example', 'https://secondary.example']);
		vi.stubGlobal('window', browserWindow(permawebOs));

		expect(aoFetch()).toBe(permawebOs);
		expect(aoPeers()).toEqual(['https://primary.example', 'https://secondary.example']);
		expect(aoPrimaryPeer()).toBe('https://primary.example');
		await expect(readyAoFetch()).resolves.toEqual(['https://primary.example', 'https://secondary.example']);
	});

	it('starts injected readiness without waiting for it to settle', () => {
		const permawebOs = injectedAoFetch(['https://primary.example']);
		permawebOs.ready = vi.fn(() => new Promise<readonly string[]>(() => undefined));
		vi.stubGlobal('window', browserWindow(permawebOs));

		const stop = warmAoFetch();
		expect(stop).toEqual(expect.any(Function));
		expect(permawebOs.ready).toHaveBeenCalledOnce();
		stop();
	});

	it('warms the role-aware network descriptor without blocking transport readiness', async () => {
		const permawebOs = injectedAoFetch(['https://hosted.example']);
		permawebOs.networkPolicy = vi.fn(
			async () =>
				({
					version: 1,
					arweaveGateway: { url: 'https://arweave.net', ownership: 'default' },
					permanentContent: { url: 'https://arweave.net', ownership: 'default' },
					publishing: { url: 'https://up.arweave.net', ownership: 'default' },
					ao: {
						processReads: [{ url: 'https://andee.example', ownership: 'personal' }],
						scheduleReads: [{ url: 'https://andee.example', ownership: 'personal' }],
						linkedStateReads: [{ url: 'https://andee.example', ownership: 'personal' }],
						observerRelay: { url: 'https://hosted.example', ownership: 'default' },
						fallbackMode: 'personal-first',
					},
				} as const)
		);
		vi.stubGlobal('window', browserWindow(permawebOs));
		const loaded = vi.fn();

		const stop = warmAoFetch(loaded);
		await vi.waitFor(() => expect(loaded).toHaveBeenCalledOnce());
		expect(permawebOs.networkPolicy).toHaveBeenCalledOnce();
		stop();
	});

	it('refreshes every role derived from the same injected transport after aoFetchLoaded', async () => {
		const permawebOs = injectedAoFetch(['https://legacy.example']);
		let policy: EffectivePermawebNetworkPolicy = {
			version: 1 as const,
			fingerprint: 'opaque-policy-one',
			arweaveGateway: { url: 'https://gateway.example', ownership: 'default' as const },
			permanentContent: { url: 'https://content-one.example', ownership: 'community' as const },
			publishing: { url: 'https://upload.example', ownership: 'default' as const },
			ao: {
				processReads: [{ url: 'https://andee-one.example', ownership: 'personal' as const }],
				scheduleReads: [{ url: 'https://andee-one.example', ownership: 'personal' as const }],
				linkedStateReads: [{ url: 'https://andee-one.example', ownership: 'personal' as const }],
				observerRelay: { url: 'https://relay-one.example', ownership: 'community' as const },
				fallbackMode: 'personal-first' as const,
			},
		};
		permawebOs.networkPolicy = vi.fn(async () => policy);
		const scope = browserWindow(permawebOs);
		vi.stubGlobal('window', scope);
		const changed = vi.fn();
		const stop = warmAoFetch(changed);

		await vi.waitFor(() => expect(changed).toHaveBeenCalledOnce());
		expect(aoPeers()).toEqual(['https://andee-one.example']);
		expect(permanentContentGatewayFromLocation()).toBe('https://content-one.example');
		expect(observerRelayFromLocation()).toBe('https://relay-one.example');
		expect(aoRoutingScopeFromLocation()).toBe('opaque-policy-one');

		policy = {
			...policy,
			fingerprint: 'opaque-policy-two',
			permanentContent: { url: 'https://content-two.example', ownership: 'community' },
			ao: {
				...policy.ao,
				processReads: [{ url: 'https://andee-two.example', ownership: 'personal' }],
				scheduleReads: [{ url: 'https://andee-two.example', ownership: 'personal' }],
				linkedStateReads: [{ url: 'https://andee-two.example', ownership: 'personal' }],
				observerRelay: { url: 'https://relay-two.example', ownership: 'community' },
				fallbackMode: 'personal-only',
			},
		};
		scope.dispatchEvent(new Event('aoFetchLoaded'));

		await vi.waitFor(() => expect(changed).toHaveBeenCalledTimes(2));
		expect(permawebOs.networkPolicy).toHaveBeenCalledTimes(2);
		expect(aoPeers()).toEqual(['https://andee-two.example']);
		expect(permanentContentGatewayFromLocation()).toBe('https://content-two.example');
		expect(observerRelayFromLocation()).toBe('https://relay-two.example');
		expect(aoRoutingScopeFromLocation()).toBe('opaque-policy-two');

		vi.mocked(permawebOs.networkPolicy).mockRejectedValueOnce(new Error('policy unavailable'));
		scope.dispatchEvent(new Event('aoFetchLoaded'));

		await vi.waitFor(() => expect(changed).toHaveBeenCalledTimes(3));
		expect(permawebOs.networkPolicy).toHaveBeenCalledTimes(3);
		expect(aoPeers()).toEqual([]);
		expect(observerRelayFromLocation()).toBe('');
		expect(aoRoutingScopeFromLocation()).toBe('permawebos-policy-unavailable:2');
		stop();
	});

	it('loads role policy when PermawebOS is injected after application startup', async () => {
		const scope = browserWindow();
		vi.stubGlobal('window', scope);
		const changed = vi.fn();
		const stop = warmAoFetch(changed);
		const permawebOs = injectedAoFetch(['https://legacy.example']);
		permawebOs.networkPolicy = vi.fn(
			async () =>
				({
					version: 1,
					arweaveGateway: { url: 'https://gateway.example', ownership: 'default' },
					permanentContent: { url: 'https://late-content.example', ownership: 'community' },
					publishing: { url: 'https://upload.example', ownership: 'default' },
					ao: {
						processReads: [{ url: 'https://late-andee.example', ownership: 'personal' }],
						scheduleReads: [{ url: 'https://late-andee.example', ownership: 'personal' }],
						linkedStateReads: [{ url: 'https://late-andee.example', ownership: 'personal' }],
						observerRelay: { url: 'https://late-relay.example', ownership: 'community' },
						fallbackMode: 'personal-first',
					},
				} as const)
		);
		Object.assign(scope, { aoFetch: permawebOs });
		scope.dispatchEvent(new Event('aoFetchLoaded'));

		await vi.waitFor(() => expect(changed).toHaveBeenCalledOnce());
		expect(aoPeers()).toEqual(['https://late-andee.example']);
		expect(permanentContentGatewayFromLocation()).toBe('https://late-content.example');
		expect(observerRelayFromLocation()).toBe('https://late-relay.example');
		stop();
	});

	it('retains known peers when injected readiness is malformed or rejects', async () => {
		const permawebOs = injectedAoFetch(['https://primary.example']);
		permawebOs.ready = undefined as unknown as PermawebOsAoFetch['ready'];
		vi.stubGlobal('window', browserWindow(permawebOs));

		await expect(readyAoFetch()).resolves.toEqual(['https://primary.example']);

		permawebOs.ready = vi.fn(async () => {
			throw new Error('extension-unavailable');
		});
		await expect(readyAoFetch()).resolves.toEqual(['https://primary.example']);
	});

	it('passes test transports through without constructing a Wrangler client', () => {
		const override = vi.fn(async () => new Response('test')) as typeof fetch;
		expect(aoFetch(override)).toBe(override);
	});

	it('routes default Bazar reads to the serving origin after an explicit peer selection', async () => {
		vi.stubGlobal('window', browserWindow(undefined, '?node=https://previous.example'));
		const nativeFetch = vi.fn(async () => new Response('ok'));
		vi.stubGlobal('fetch', nativeFetch);

		expect(await (await aoFetch()('/first')).text()).toBe('ok');
		nativeFetch.mockClear();
		vi.stubGlobal('window', browserWindow());

		const direct = aoFetch() as ReturnType<typeof createBazarAoFetch>;
		expect(direct.peers).toEqual(['https://bazar.example', 'https://arweave.net']);
		expect(aoPeers()).toEqual(['https://bazar.example', 'https://arweave.net']);
		await direct('/process~process@1.0/now?max-age=60', { method: 'GET' });
		expect(nativeFetch).toHaveBeenCalledWith(
			'https://bazar.example/process~process@1.0/now?max-age=60',
			expect.objectContaining({ method: 'GET' })
		);
	});

	it('uses Bazar AO.js with the fallback peers when the user disables PermawebOS', () => {
		const permawebOs = injectedAoFetch(['https://permawebos.example']);
		vi.stubGlobal(
			'window',
			browserWindow(
				permawebOs,
				`?ao-transport=bazar&node=${encodeURIComponent('https://alpha.example,https://charlie.example')}`
			)
		);

		const direct = aoFetch() as ReturnType<typeof createBazarAoFetch>;
		expect(direct).not.toBe(permawebOs);
		expect(direct.peers).toEqual(['https://alpha.example', 'https://charlie.example']);
		expect(aoPeers()).toEqual(['https://alpha.example', 'https://charlie.example']);
	});

	it('does not bypass PermawebOS when every configured peer request fails', async () => {
		const permawebOs = injectedAoFetch(['https://unavailable.example']);
		const failure = new Error('Every PermawebOS AO Peer failed.');
		vi.mocked(permawebOs).mockRejectedValue(failure);
		const nativeFetch = vi.fn(async () => new Response('unexpected fallback'));
		vi.stubGlobal('fetch', nativeFetch);
		vi.stubGlobal('window', browserWindow(permawebOs));

		await expect(aoFetch()('/process~process@1.0/now')).rejects.toBe(failure);
		expect(nativeFetch).not.toHaveBeenCalled();
	});
});

describe('Bazar AO.js routing', () => {
	it('routes an application peer URL through the full fallback list', async () => {
		const requested: string[] = [];
		const fetcher = vi.fn(async (input: RequestInfo | URL) => {
			const url = String(input);
			requested.push(url);
			return url.startsWith('https://alpha.example/')
				? new Response('slow down', { status: 429, headers: { 'retry-after': '0' } })
				: new Response('charlie');
		});
		const routed = createBazarAoFetch(
			['https://alpha.example', 'https://charlie.example'],
			fetcher as typeof fetch
		);

		const response = await routed('https://alpha.example/process-0~process@1.0/now');

		expect(await response.text()).toBe('charlie');
		expect(new Set(requested.filter((url) => url.endsWith('/process-0~process@1.0/now')))).toEqual(
			new Set([
				'https://alpha.example/process-0~process@1.0/now',
				'https://charlie.example/process-0~process@1.0/now',
			])
		);
	});

	it('fails over a compute read when its preferred peer returns a server error', async () => {
		const computeRequests: string[] = [];
		const routed = createBazarAoFetch(
			['https://alpha.example', 'https://charlie.example'],
			vi.fn(async (input: RequestInfo | URL) => {
				const url = String(input);
				computeRequests.push(url);
				return computeRequests.length === 1
					? new Response('hydrating', { status: 502 })
					: new Response('ready');
			}) as typeof fetch
		);

		const response = await routed('https://alpha.example/process~process@1.0/now');

		expect(await response.text()).toBe('ready');
		expect(computeRequests).toHaveLength(2);
		expect(new Set(computeRequests.map((url) => new URL(url).origin))).toEqual(
			new Set(['https://alpha.example', 'https://charlie.example'])
		);
	});

	it('distributes hashpaths across stable primary peers', async () => {
		const requested: string[] = [];
		const routed = createBazarAoFetch(
			['https://alpha.example', 'https://charlie.example'],
			vi.fn(async (input: RequestInfo | URL) => {
				requested.push(String(input));
				return new Response('ok');
			}) as typeof fetch
		);

		for (let index = 0; index < 8; index += 1) {
			expect(await (await routed(`https://alpha.example/process-${index}~process@1.0/now`)).text()).toBe('ok');
		}
		expect(new Set(requested.map((url) => new URL(url).origin))).toEqual(
			new Set(['https://alpha.example', 'https://charlie.example'])
		);
	});

	it('leaves an explicitly different origin untouched', async () => {
		const requested: string[] = [];
		const fetcher = vi.fn(async (input: RequestInfo | URL) => {
			requested.push(String(input));
			return new Response('ok');
		});
		const routed = createBazarAoFetch(
			['https://alpha.example', 'https://charlie.example'],
			fetcher as typeof fetch
		);

		await routed('https://arweave.net/graphql');

		expect(requested.at(-1)).toBe('https://arweave.net/graphql');
	});

	it('pins the read hedge delay and the per-peer request deadline', () => {
		expect(AO_READ_HEDGE_AFTER_MS).toBe(1_500);
		expect(AO_REQUEST_TIMEOUT_MS).toBe(12_000);
	});

	it('hedges a read to the next peer when the first has not answered after the hedge delay', async () => {
		vi.useFakeTimers();
		try {
			const requested: string[] = [];
			let abandoned: string | undefined;
			const routed = createBazarAoFetch(
				['https://alpha.example', 'https://charlie.example'],
				vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
					const origin = new URL(String(input)).origin;
					requested.push(origin);
					if (requested.length > 1) return Promise.resolve(new Response(origin));
					return new Promise<Response>((_resolve, reject) => {
						init?.signal?.addEventListener('abort', () => {
							abandoned = origin;
							reject(init.signal?.reason);
						});
					});
				}) as typeof fetch
			);

			const response = routed('https://alpha.example/slow~process@1.0/compute', { method: 'HEAD' });
			await vi.advanceTimersByTimeAsync(AO_READ_HEDGE_AFTER_MS - 1);
			expect(requested).toHaveLength(1);
			await vi.advanceTimersByTimeAsync(1);

			const winner = await response;
			expect(requested).toHaveLength(2);
			expect(await winner.text()).toBe(requested[1]);
			expect(abandoned).toBe(requested[0]);
		} finally {
			vi.useRealTimers();
		}
	});

	it('waits for a slow compute answer longer than the former four-second deadline', async () => {
		vi.useFakeTimers();
		try {
			const routed = createBazarAoFetch(
				['https://alpha.example'],
				vi.fn(
					(_input: RequestInfo | URL, init?: RequestInit) =>
						new Promise<Response>((resolve, reject) => {
							const timer = setTimeout(() => resolve(new Response('computed')), 11_000);
							init?.signal?.addEventListener('abort', () => {
								clearTimeout(timer);
								reject(init.signal?.reason);
							});
						})
				) as typeof fetch
			);

			const response = routed('https://alpha.example/cold~process@1.0/compute');
			await vi.advanceTimersByTimeAsync(11_000);

			expect(await (await response).text()).toBe('computed');
		} finally {
			vi.useRealTimers();
		}
	});

	it('can return a not-found response for an optional AO path', async () => {
		const routed = createBazarAoFetch(
			['https://alpha.example'],
			vi.fn(async () => new Response('not_found', { status: 404 })) as typeof fetch
		);

		const response = await routed.allowNotFound('https://alpha.example/message~message@1.0/device');

		expect(response.status).toBe(404);
		expect(await response.text()).toBe('not_found');
	});
});

describe('Bazar AO.js process state admissibility', () => {
	const processIds = ['IyFfmbTu8P4rv0KyrA0Q-QtfEnYntMj4RkRiBVip9KA', 'A'.repeat(43), 'B'.repeat(43), 'C'.repeat(43)];
	const spaShell = () =>
		new Response('<!doctype html><title>Bazar</title>', { headers: { 'content-type': 'text/html' } });
	const processState = (slot = 65) =>
		new Response(null, {
			headers: {
				'at-slot': String(slot),
				'content-type': 'multipart/form-data; boundary="state"',
				device: 'process@1.0',
				'execution-device': 'token@1.0',
				name: 'Computed state',
				'total-supply': '1',
			},
		});

	it('routes a state read past a static host that answers with its HTML shell', async () => {
		const requested: string[] = [];
		const routed = createBazarAoFetch(
			['https://bazar.example', 'https://compute.example'],
			vi.fn(async (input: RequestInfo | URL) => {
				const url = String(input);
				requested.push(url);
				return url.startsWith('https://bazar.example/') ? spaShell() : processState();
			}) as typeof fetch
		);

		for (const processId of processIds) {
			const result = await readAssetState(processId, { fetch: routed, includeBalances: false });
			expect(result.state.raw).toMatchObject({ 'at-slot': '65', name: 'Computed state' });
			expect(result.state.raw).not.toHaveProperty('content-type', 'text/html');
		}
		expect(requested.some((url) => url.startsWith('https://bazar.example/'))).toBe(true);
	});

	it('routes a state read past a header-only answer without the evaluated slot', async () => {
		const requested: string[] = [];
		const routed = createBazarAoFetch(
			['https://hollow.example', 'https://compute.example'],
			vi.fn(async (input: RequestInfo | URL) => {
				const url = String(input);
				requested.push(url);
				return url.startsWith('https://hollow.example/')
					? new Response(null, { headers: { 'content-type': 'multipart/form-data; boundary="empty"' } })
					: processState(12);
			}) as typeof fetch
		);

		for (const processId of processIds) {
			const response = await routed(`/${processId}~process@1.0/compute&max-age=60`, { method: 'HEAD' });
			expect(response.headers.get('at-slot')).toBe('12');
		}
		expect(requested.some((url) => url.startsWith('https://hollow.example/'))).toBe(true);
	});

	it('never parses state when every peer answers a state read with HTML', async () => {
		const routed = createBazarAoFetch(
			['https://bazar.example', 'https://static.example'],
			vi.fn(async () => spaShell()) as typeof fetch
		);

		await expect(
			readAssetState(processIds[0], { fetch: routed, includeBalances: false, maxAge: 0 })
		).rejects.toThrow('ao-inadmissible-process-state');
	});

	it('accepts linked message and mounted-device reads that carry no slot', async () => {
		const routed = createBazarAoFetch(
			['https://compute.example'],
			vi.fn(async () => new Response(null, { headers: { device: 'trie@1.0' } })) as typeof fetch
		);

		const message = await routed(`/${'M'.repeat(43)}~message@1.0`, { method: 'HEAD' });
		const device = await routed(`/${processIds[0]}~process@1.0/compute&max-age=60/balances/device`);

		expect(message.headers.get('device')).toBe('trie@1.0');
		expect(device.ok).toBe(true);
	});

	it('leaves peer discovery free to read the node info message', async () => {
		const requested: string[] = [];
		vi.stubGlobal(
			'fetch',
			vi.fn(async (input: RequestInfo | URL) => {
				const url = String(input);
				requested.push(url);
				return url.includes('/~meta@1.0/') ? spaShell() : processState(7);
			})
		);
		const routed = createBazarAoFetch(['https://compute.example']);

		const response = await routed(`/${processIds[0]}~process@1.0/now`, { method: 'HEAD' });

		expect(response.headers.get('at-slot')).toBe('7');
		expect(requested).toContain('https://compute.example/~meta@1.0/info/serialize~json@1.0');
	});
});

describe('Bazar default compute peers', () => {
	const tokenId = 'IyFfmbTu8P4rv0KyrA0Q-QtfEnYntMj4RkRiBVip9KA';
	const probeUrl = (origin: string) => `${origin}/${tokenId}~process@1.0/compute&max-age=86400`;
	const servedWindow = (hostname: string, search = '', sessionStorage?: Pick<Storage, 'getItem' | 'setItem'>) =>
		Object.assign(browserWindow(undefined, search, false), {
			location: { protocol: 'https:', hostname, port: '', search, hash: '' },
			...(sessionStorage ? { sessionStorage } : {}),
		});
	const processState = () =>
		new Response(null, {
			headers: { 'at-slot': '65', 'content-type': 'multipart/form-data; boundary="state"' },
		});

	it('tries the serving origin before the default peers for every process', async () => {
		const requested: string[] = [];
		const routed = createBazarAoFetch(
			['https://bazar.example', 'https://arweave.net'],
			vi.fn(async (input: RequestInfo | URL) => {
				requested.push(String(input));
				return processState();
			}) as typeof fetch,
			{ ordered: true }
		);

		for (const processId of [tokenId, 'A'.repeat(43), 'B'.repeat(43), 'C'.repeat(43), 'D'.repeat(43)]) {
			await routed(`/${processId}~process@1.0/compute&max-age=60`, { method: 'HEAD' });
		}
		expect(requested).toHaveLength(5);
		expect(requested.every((url) => url.startsWith('https://bazar.example/'))).toBe(true);
	});

	it('falls back to the next default peer when the serving origin has no compute', async () => {
		const requested: string[] = [];
		const routed = createBazarAoFetch(
			['https://bazar.example', 'https://arweave.net'],
			vi.fn(async (input: RequestInfo | URL) => {
				requested.push(String(input));
				return String(input).startsWith('https://bazar.example/')
					? new Response('Not Found', { status: 404 })
					: processState();
			}) as typeof fetch,
			{ ordered: true }
		);

		const response = await routed(`/${tokenId}~process@1.0/compute&max-age=60`, { method: 'HEAD' });
		expect(response.headers.get('at-slot')).toBe('65');
		expect(requested).toEqual([
			`https://bazar.example/${tokenId}~process@1.0/compute&max-age=60`,
			`https://arweave.net/${tokenId}~process@1.0/compute&max-age=60`,
		]);
	});

	it.each([
		['not-found', 'arns-host.example', () => new Response('Not Found', { status: 404 })],
		[
			'an HTML shell',
			'static-host.example',
			() => new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } }),
		],
	])('drops a serving origin that answers a known process read with %s', async (_label, hostname, answer) => {
		const origin = `https://${hostname}`;
		vi.stubGlobal('window', servedWindow(hostname));
		const fetcher = vi.fn(async () => answer());

		await expect(probeServingOriginCompute(tokenId, fetcher as typeof fetch)).resolves.toBe(true);
		expect(fetcher).toHaveBeenCalledWith(probeUrl(origin), expect.objectContaining({ method: 'HEAD' }));
		expect((aoFetch() as ReturnType<typeof createBazarAoFetch>).peers).toEqual(['https://arweave.net']);
		expect(aoPeers()).toEqual(['https://arweave.net']);
		await expect(probeServingOriginCompute(tokenId, fetcher as typeof fetch)).resolves.toBe(false);
		expect(fetcher).toHaveBeenCalledOnce();
	});

	it.each([
		['computes process state', 'compute-host.example', async () => processState()],
		['fails transiently', 'flaky-host.example', async () => new Response('busy', { status: 502 })],
		[
			'cannot be reached',
			'offline-host.example',
			async (): Promise<Response> => {
				throw new TypeError('Failed to fetch');
			},
		],
	])('keeps a serving origin that %s and asks it only once', async (_label, hostname, answer) => {
		vi.stubGlobal('window', servedWindow(hostname));
		const fetcher = vi.fn(answer);

		await expect(probeServingOriginCompute(tokenId, fetcher as typeof fetch)).resolves.toBe(false);
		await expect(probeServingOriginCompute(tokenId, fetcher as typeof fetch)).resolves.toBe(false);
		expect(fetcher).toHaveBeenCalledOnce();
		expect(aoPeers()).toEqual([`https://${hostname}`, 'https://arweave.net']);
	});

	it('never probes an explicitly selected peer list', async () => {
		vi.stubGlobal('window', servedWindow('selected-host.example', '?node=https://selected-host.example'));
		const fetcher = vi.fn(async () => new Response('Not Found', { status: 404 }));

		await expect(probeServingOriginCompute(tokenId, fetcher as typeof fetch)).resolves.toBe(false);
		expect(fetcher).not.toHaveBeenCalled();
		expect(aoPeers()).toEqual(['https://selected-host.example']);
	});

	it('starts the next page load in the tab without the dropped origin and without probing', async () => {
		const items = new Map<string, string>();
		const sessionStorage = {
			getItem: (key: string) => items.get(key) ?? null,
			setItem: (key: string, value: string) => void items.set(key, value),
		};
		vi.stubGlobal('window', servedWindow('reload-host.example', '', sessionStorage));
		const fetcher = vi.fn(async () => new Response('Not Found', { status: 404 }));
		await expect(probeServingOriginCompute(tokenId, fetcher as typeof fetch)).resolves.toBe(true);

		vi.resetModules();
		const reloaded = await import('./ao');
		expect(reloaded.aoPeers()).toEqual(['https://arweave.net']);
		await expect(reloaded.probeServingOriginCompute(tokenId, fetcher as typeof fetch)).resolves.toBe(false);
		expect(fetcher).toHaveBeenCalledOnce();
	});

	it('refreshes routing and rediscovers the remaining peers once warming drops the serving origin', async () => {
		vi.stubGlobal('window', servedWindow('warm-host.example'));
		const requested: string[] = [];
		const nativeFetch = vi.fn(async (input: RequestInfo | URL) => {
			requested.push(String(input));
			return new Response('Not Found', { status: 404 });
		});
		vi.stubGlobal('fetch', nativeFetch);
		const changed = vi.fn();
		const discovery = (origin: string) =>
			requested.filter((url) => url.startsWith(`${origin}/~meta@1.0/info/`)).length;

		const stop = warmAoFetch(changed, { probeProcessId: tokenId });

		await vi.waitFor(() => expect(changed).toHaveBeenCalledOnce());
		expect(requested).toContain(probeUrl('https://warm-host.example'));
		expect(aoPeers()).toEqual(['https://arweave.net']);
		// The first transport discovered both peers; the one without the origin discovers arweave.net again.
		await vi.waitFor(() => expect(discovery('https://arweave.net')).toBe(2));
		expect(discovery('https://warm-host.example')).toBe(1);
		stop();
	});
});

describe('Bazar configured AO peer order', () => {
	const ids = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((letter) => letter.repeat(43));
	const processState = (body = 'state') =>
		new Response(body, {
			headers: { 'at-slot': '65', 'content-type': 'multipart/form-data; boundary="state"' },
		});
	/** Requests for application paths, leaving out AO.js peer discovery. */
	const reads = (requested: string[]) => requested.filter((url) => !url.includes('/~meta@1.0/'));
	const transport = (answer: (url: string, init?: RequestInit) => Promise<Response>) => {
		const requested: string[] = [];
		vi.stubGlobal(
			'fetch',
			vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
				const url = String(input);
				requested.push(url);
				return url.includes('/~meta@1.0/')
					? Promise.resolve(new Response('', { status: 404 }))
					: answer(url, init);
			})
		);
		return requested;
	};

	afterEach(() => {
		vi.unstubAllEnvs();
		vi.resetModules();
	});

	it('sends every read of a ?node= selection to its first peer while it answers', async () => {
		vi.stubGlobal(
			'window',
			browserWindow(undefined, '?node=https://primary.example,https://fallback.example', false)
		);
		const requested = transport(async () => processState());

		for (const id of ids) {
			await aoFetch()(`/${id}~process@1.0/compute&max-age=60`, { method: 'HEAD' });
			await aoFetch()(`/${id}~message@1.0`, { method: 'HEAD' });
		}

		expect(reads(requested)).toHaveLength(ids.length * 2);
		expect(reads(requested).every((url) => url.startsWith('https://primary.example/'))).toBe(true);
	});

	it('sends every read of a VITE_COMPUTE_GATEWAY list to its first peer while it answers', async () => {
		vi.stubEnv('VITE_COMPUTE_GATEWAY', 'https://primary.example,https://fallback.example');
		vi.resetModules();
		const configured = await import('./ao');
		vi.stubGlobal('window', browserWindow(undefined, '', false));
		const requested = transport(async () => processState());

		for (const id of ids) await configured.aoFetch()(`/${id}~process@1.0/now`, { method: 'HEAD' });

		expect(configured.aoPeers()).toEqual(['https://primary.example', 'https://fallback.example']);
		expect(reads(requested)).toHaveLength(ids.length);
		expect(reads(requested).every((url) => url.startsWith('https://primary.example/'))).toBe(true);
	});

	it('hedges a read of a ?node= selection to the second peer after the hedge delay', async () => {
		vi.useFakeTimers();
		try {
			vi.stubGlobal(
				'window',
				browserWindow(undefined, '?node=https://slow.example,https://fallback.example', false)
			);
			let abandoned = false;
			const requested = transport((url, init) => {
				if (url.startsWith('https://fallback.example/')) return Promise.resolve(processState('fallback'));
				return new Promise<Response>((_resolve, reject) => {
					init?.signal?.addEventListener('abort', () => {
						abandoned = true;
						reject(init.signal?.reason);
					});
				});
			});

			const response = aoFetch()(`/${ids[0]}~process@1.0/compute&max-age=60`);
			await vi.advanceTimersByTimeAsync(AO_READ_HEDGE_AFTER_MS - 1);
			expect(reads(requested)).toEqual([`https://slow.example/${ids[0]}~process@1.0/compute&max-age=60`]);
			await vi.advanceTimersByTimeAsync(1);

			expect(await (await response).text()).toBe('fallback');
			expect(reads(requested)).toEqual([
				`https://slow.example/${ids[0]}~process@1.0/compute&max-age=60`,
				`https://fallback.example/${ids[0]}~process@1.0/compute&max-age=60`,
			]);
			expect(abandoned).toBe(true);
		} finally {
			vi.useRealTimers();
		}
	});

	it.each([
		['an HTML shell', () => new Response('<!doctype html>', { headers: { 'content-type': 'text/html' } })],
		['state without the evaluated slot', () => new Response(null, { headers: { device: 'process@1.0' } })],
	])('falls through from a first peer that answers a state read with %s', async (_label, answer) => {
		vi.stubGlobal(
			'window',
			browserWindow(undefined, '?node=https://static.example,https://compute.example', false)
		);
		const requested = transport(async (url) =>
			url.startsWith('https://static.example/') ? answer() : processState()
		);

		const response = await aoFetch()(`/${ids[1]}~process@1.0/now`, { method: 'HEAD' });

		expect(response.headers.get('at-slot')).toBe('65');
		expect(reads(requested)).toEqual([
			`https://static.example/${ids[1]}~process@1.0/now`,
			`https://compute.example/${ids[1]}~process@1.0/now`,
		]);
	});

	it('serves a single-peer selection and fails, rather than hangs, when it cannot answer a message', async () => {
		vi.stubGlobal('window', browserWindow(undefined, '?node=https://only.example', false));
		const requested = transport(async (url) =>
			url.includes('~message@1.0') ? new Response('not_found', { status: 404 }) : processState()
		);

		const state = await aoFetch()(`/${ids[3]}~process@1.0/now`, { method: 'HEAD' });
		expect(state.headers.get('at-slot')).toBe('65');
		await expect(aoFetch()(`/${ids[3]}~message@1.0`, { method: 'HEAD' })).rejects.toThrow(
			'ao.js-response-quorum-not-met'
		);
		expect(reads(requested)).toEqual([
			`https://only.example/${ids[3]}~process@1.0/now`,
			`https://only.example/${ids[3]}~message@1.0`,
		]);
	});
});
