import { describe, expect, it, vi } from 'vitest';

import { connectWallet, createLatestAddressCommitter } from './WalletProvider';

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((next) => { resolve = next; });
	return { promise, resolve };
}

describe('explicit wallet connection', () => {
	it('returns the active address only after the requested permissions are granted', async () => {
		const connect = vi.fn(async () => undefined);
		const address = 'a'.repeat(43);
		await expect(connectWallet({
			connect,
			getActiveAddress: async () => address,
			sign: async (transaction) => transaction,
		})).resolves.toBe(address);
		expect(connect).toHaveBeenCalledWith([
			'ACCESS_ADDRESS',
			'ACCESS_PUBLIC_KEY',
			'SIGN_TRANSACTION',
		]);
	});

	it('rejects a connection whose active address cannot be read', async () => {
		await expect(connectWallet({
			connect: async () => undefined,
			getActiveAddress: async () => { throw new Error('locked'); },
			sign: async (transaction) => transaction,
		})).rejects.toThrow('active address could not be read');
	});

	it('rejects a connection that returns no active address', async () => {
		await expect(connectWallet({
			connect: async () => undefined,
			sign: async (transaction) => transaction,
		})).rejects.toThrow('no valid active address');
	});
});

describe('wallet address request ordering', () => {
	it('ignores an older address read that resolves after a wallet switch', async () => {
		const addresses: Array<string | null> = [];
		const requests = createLatestAddressCommitter((address) => addresses.push(address));
		const first = deferred<string>();
		const second = deferred<string>();
		const read = async (promise: Promise<string>) => {
			const commit = requests.begin();
			commit(await promise);
		};

		const firstRead = read(first.promise);
		const secondRead = read(second.promise);
		second.resolve('b'.repeat(43));
		await secondRead;
		first.resolve('a'.repeat(43));
		await firstRead;

		expect(addresses).toEqual(['b'.repeat(43)]);
	});

	it('keeps a disconnect after a pending address read resolves', async () => {
		const addresses: Array<string | null> = [];
		const requests = createLatestAddressCommitter((address) => addresses.push(address));
		const pending = deferred<string>();
		const commitPending = requests.begin();
		const pendingRead = pending.promise.then(commitPending);
		const commitDisconnect = requests.begin();

		commitDisconnect(null);
		pending.resolve('a'.repeat(43));
		await pendingRead;

		expect(addresses).toEqual([null]);
	});
});
