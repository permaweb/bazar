import { describe, expect, it } from 'vitest';

import type { ResolvedAsset } from 'api/discovery';

import {
	listedUniquePrice,
	sortWalletResults,
	walletAssetHolding,
	walletGroupResults,
} from 'features/MyAssets/model/wallet-assets';

const wallet = 'W'.repeat(43);

function resolved(
	id: string,
	options: { kind?: 'tokens' | 'images'; liquid?: string; listed?: string; height?: number; timestamp?: number } = {}
): ResolvedAsset {
	const orderId = `${id}-order`;
	const listed = options.listed ?? '0';
	return {
		asset: { id, name: id },
		collection: {
			id: options.kind ?? 'tokens',
			name: 'Assets',
			description: '',
			kind: options.kind ?? 'tokens',
			assets: [],
		},
		provider: 'https://arweave.net',
		activity: {
			processId: id,
			height: options.height ?? 1,
			timestamp: options.timestamp ?? 1,
			sources: ['market-action'],
		},
		state: {
			device: 'token@1.0',
			name: id,
			ticker: id,
			denomination: 0,
			totalSupply: '100',
			balances: { [wallet]: options.liquid ?? '0' },
			orders:
				listed === '0'
					? {}
					: {
							[orderId]: {
								orderId,
								creator: wallet,
								recipient: id,
								asking: '2500000000000',
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

describe('wallet asset selectors', () => {
	it('orders results by newest block, then newest timestamp, without mutating the source', () => {
		const older = resolved('older', { height: 10, timestamp: 5 });
		const sameBlockEarlier = resolved('same-block-earlier', { height: 20, timestamp: 1 });
		const newest = resolved('newest', { height: 20, timestamp: 9 });
		const source = [older, sameBlockEarlier, newest];

		expect(sortWalletResults(source)).toEqual([newest, sameBlockEarlier, older]);
		expect(source).toEqual([older, sameBlockEarlier, newest]);
		expect(sortWalletResults(new Map([['a', older]]).values())).toEqual([older]);
		expect(sortWalletResults([])).toEqual([]);
	});

	it('splits tokens from uniques and narrows each group to listed assets on request', () => {
		const ownedToken = resolved('owned-token', { liquid: '2' });
		const listedToken = resolved('listed-token', { listed: '3' });
		const ownedUnique = resolved('owned-unique', { kind: 'images', liquid: '1' });
		const listedUnique = resolved('listed-unique', { kind: 'images', listed: '1' });
		const results = [ownedToken, listedToken, ownedUnique, listedUnique];

		expect(walletGroupResults(results, wallet, 'tokens', 'all')).toEqual([ownedToken, listedToken]);
		expect(walletGroupResults(results, wallet, 'tokens', 'listed')).toEqual([listedToken]);
		expect(walletGroupResults(results, wallet, 'uniques', 'all')).toEqual([ownedUnique, listedUnique]);
		expect(walletGroupResults(results, wallet, 'uniques', 'listed')).toEqual([listedUnique]);
		expect(walletGroupResults(results, 'X'.repeat(43), 'uniques', 'listed')).toEqual([]);
	});

	it('shows liquid plus listed balances, or only the listed quantity in the listed view', () => {
		const token = resolved('token', { liquid: '9007199254740993', listed: '7' });

		expect(walletAssetHolding(token, wallet, 'all')).toEqual({ listed: true, balance: '9007199254741000' });
		expect(walletAssetHolding(token, wallet, 'listed')).toEqual({ listed: true, balance: '7' });
		expect(walletAssetHolding(resolved('held', { liquid: '4' }), wallet, 'all')).toEqual({
			listed: false,
			balance: '4',
		});
	});

	it('prices only the wallet’s own listing of a unique asset', () => {
		const unique = resolved('unique', { kind: 'images', listed: '1' });
		unique.state.totalSupply = '1';

		expect(listedUniquePrice(unique, wallet)).toBe('2.5 AR');
		expect(walletAssetHolding(unique, wallet, 'all')).toEqual({
			listed: true,
			balance: '1',
			uniquePrice: '2.5 AR',
		});
		expect(listedUniquePrice(resolved('token', { listed: '1' }), wallet)).toBeUndefined();
		expect(walletAssetHolding(unique, 'X'.repeat(43), 'all')).toEqual({ listed: false, balance: '0' });
	});
});
