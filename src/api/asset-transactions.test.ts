import { describe, expect, it } from 'vitest';
import { SwapPurchase } from 'weave-wrangler';

import { AssetTransactionClient } from './asset-transactions';

const processId = 'IMKioUfmOrqtTnrLO3_Jpg5zv8zg8PKjWYNVhD3xsZM';
const seller = '1uTLV5GvfQ5M46Tq_DTeJL7rIy7vCAOMxQ7Fbf82YZw';
const recipient = 'BLyLiOZptmb-olB8wycvk_ynHiu1SZMKPqswx4KONwc';
const transactionId = 'qAhWNMSuX70lZpIRohKJn_SuVcymr_RmpGbltydjpwA';

function client() {
	const values = new Map<string, string>();
	const storage = {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => values.set(key, value),
		removeItem: (key: string) => values.delete(key),
		key: (index: number) => [...values.keys()][index] ?? null,
		get length() {
			return values.size;
		},
	};
	const arweave = {
		createTransaction: async ({ target, quantity, data }: Record<string, string>) => {
			const transaction: any = {
				id: transactionId,
				owner: 'owner-key',
				target,
				quantity,
				data,
				reward: '1000',
				tags: [] as Array<{ name: string; value: string }>,
				addTag(name: string, value: string) {
					this.tags.push({ name, value });
				},
				toJSON() {
					return { ...this, addTag: undefined, toJSON: undefined };
				},
			};
			return transaction;
		},
		wallets: { ownerToAddress: async () => seller },
	};
	return { storage, arweave, client: new AssetTransactionClient({
		wallet: {
			getActiveAddress: async () => seller,
			sign: async (transaction: any) => transaction,
		},
		arweave,
		storage,
		fetch: async () => new Response('0'),
	}) };
}

describe('fungible asset transactions', () => {
	it('puts the exact token lot in offer-quantity while sending only the scheduler dust', async () => {
		const subject = client();
		const prepared = await subject.client.makeOffer({
			processId,
			quantity: '3500000000000',
			asking: '700000000000',
			seller,
		});
		const stored = JSON.parse(subject.storage.getItem(`bazar-signed-transaction:${prepared.id}`)!);
		expect(prepared.id).toBe(transactionId);
		expect(stored.transaction.quantity).toBe('1');
		expect(stored.transaction.tags).toContainEqual({ name: 'offer-quantity', value: '3500000000000' });
		expect(stored.transaction.tags).toContainEqual({ name: 'asking', value: '700000000000' });
	});

	it('accepts arbitrary atomic transfer quantities', async () => {
		const subject = client();
		const prepared = await subject.client.transfer(processId, recipient, '12500000000000', seller);
		const stored = JSON.parse(subject.storage.getItem(`bazar-signed-transaction:${prepared.id}`)!);
		expect(stored.transaction.quantity).toBe('1');
		expect(stored.transaction.tags).toContainEqual({ name: 'quantity', value: '12500000000000' });
	});

	it('rejects zero and malformed token quantities before signing', async () => {
		await expect(client().client.makeOffer({ processId, quantity: '0', asking: '1', seller }))
			.rejects.toThrow('invalid-token-quantity');
		await expect(client().client.transfer(processId, recipient, '1.5', seller))
			.rejects.toThrow('invalid-token-quantity');
	});

	it('includes the one-winston scheduler quantity in purchase estimates', async () => {
		const subject = new AssetTransactionClient({ fetch: async () => new Response('1000') });
		await expect(subject.estimatePurchaseCosts(swapOrder(transactionId, '3000000000000', '1000000'), processId))
			.resolves.toMatchObject({ total: '101001001' });
	});

	it('rejects an unaffordable batch before opening any wallet signature prompts', async () => {
		let signatures = 0;
		const subject = client();
		const unavailable = new AssetTransactionClient({
			wallet: {
				getActiveAddress: async () => seller,
				sign: async (transaction: any) => {
					signatures += 1;
					return transaction;
				},
			},
			arweave: subject.arweave,
			storage: subject.storage,
			fetch: async (url: string | URL | Request) =>
				new Response(String(url).includes('/wallet/') ? '0' : '1000'),
		});
		await expect(unavailable.preparePurchaseBatch([
			{
				processId,
				order: swapOrder(transactionId, '3000000000000', '1000000'),
				buyer: seller,
				startingBalance: '0',
				network: { tip: () => 0 } as any,
			},
		])).rejects.toThrow('asset-purchase-insufficient-funds');
		expect(signatures).toBe(0);
	});

	it('verifies every batch order is gone and the aggregate quantity arrived', async () => {
		const first = swapOrder(transactionId, '3000000000000', '1000000');
		const second = swapOrder('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA', '5000000000000', '2000000');
		const state = JSON.stringify({
			'execution-device': 'token@1.0',
			'total-supply': '1000000000000000000',
			denomination: 12,
			ticker: 'WEAVE',
			balances: { [seller]: '8000000000000' },
			orders: {},
		});
		const subject = new AssetTransactionClient({ fetch: async () => new Response(state) });
		await expect(subject.waitForPurchaseBatch(processId, seller, '0', [first, second])).resolves.toMatchObject({
			balances: { [seller]: '8000000000000' },
		});
	});

	it('hands a fresh pre-signed batch to the lifecycle without an invalid payment resume', async () => {
		const order = swapOrder(transactionId, '3000000000000', '1000000');
		const subject = client();
		const buyer = new AssetTransactionClient({
			wallet: {
				getActiveAddress: async () => seller,
				sign: async (transaction: any) => transaction,
			},
			arweave: subject.arweave,
			storage: subject.storage,
			fetch: async (url: string | URL | Request) => {
				const path = String(url);
				if (path.includes('/wallet/')) return new Response('1000000000000');
				if (path.includes('/price/')) return new Response('1000');
				if (path.endsWith('/info')) return Response.json({ height: 1000 });
				return Response.json({
					'execution-device': 'token@1.0',
					'total-supply': '1000000000000000000',
					denomination: 12,
					ticker: 'WEAVE',
					balances: { [recipient]: '3000000000000' },
					orders: {
						[transactionId]: {
							'order-id': transactionId,
							creator: recipient,
							recipient,
							asking: order.asking,
							'minimum-fee': order.minimumFee,
							deadline: order.deadline,
							'created-at': order.createdAt,
							quantity: order.quantity,
							status: 'open',
						},
					},
				});
			},
		});
		const network = { tip: () => 1000 } as any;
		const [prepared] = await buyer.preparePurchaseBatch([{
			processId,
			order,
			buyer: seller,
			startingBalance: '0',
			network,
		}]);

		expect(prepared.snapshot).toEqual({ registration: { id: transactionId, dispatched: false } });
		const adapter = buyer.purchaseAdapter({ processId, order, buyer: seller, startingBalance: '0', network });
		expect(() => new SwapPurchase(
			network,
			adapter,
			{ resume: prepared.snapshot },
		)).not.toThrow();
		expect((await adapter.restorePrepared!('registration', prepared.registration.id, new AbortController().signal)).validUntilHeight)
			.toBeDefined();
		expect((await adapter.restorePrepared!('payment', prepared.payment.id, new AbortController().signal)).validUntilHeight)
			.toBeUndefined();
	});
});

function swapOrder(orderId: string, quantity: string, asking: string) {
	return {
		orderId,
		creator: recipient,
		recipient,
		asking,
		deposit: '0',
		minimumFee: '100000000',
		deadline: 20,
		createdAt: 1,
		quantity,
		status: 'open' as const,
	};
}
