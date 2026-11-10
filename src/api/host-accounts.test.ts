import { describe, expect, it } from 'vitest';

import { atomicOperationStateError, atomicPurchaseRecoveryStatus } from '../app/App';
import { fungibleHolders, fungibleOperationStateError } from '../app/FungibleAssetView';
import { atomicPurchaseRecoveryCanBeDiscarded, operationRecoveryCanStillApply } from '../app/operation-activity';
import { marketActivityReservation } from '../components/MarketActivityList';
import vectors from '../helpers/host-account.vectors.json';

import {
	type AssetState,
	isBalanceIdentity,
	liquidBalanceOf,
	listedBalanceOf,
	ownerOfAsset,
	parseAssetState,
	parseSwapOrder,
	readAssetState,
	type SwapOrder,
} from './asset-marketplace';
import {
	assertExactCancelAssignment,
	assertExactFungibleTransferAssignment,
	assertExactPurchaseAssignment,
	AssetTransactionClient,
	hasExactCancelTransition,
	hasExactFungibleTransferReceipt,
	hasExactPurchaseTransition,
} from './asset-transactions';
import { createDispatchPlan } from './fungible-dispatch';

const seller = vectors.valid[1];
const buyer = vectors.valid[2];
const processId = 'P'.repeat(43);
const orderId = 'O'.repeat(43);
const transactionId = 'T'.repeat(43);

function order(overrides: Partial<SwapOrder> = {}): SwapOrder {
	return {
		orderId,
		creator: seller.host,
		recipient: seller.host,
		asking: '1000',
		deposit: '0',
		minimumFee: '0',
		deadline: 20,
		createdAt: 1,
		quantity: '1',
		status: 'open',
		...overrides,
	};
}

function rawOrder() {
	return { ...order(), 'order-id': orderId, 'created-at': 1, buyer: buyer.host, 'reserved-until': 100 };
}

function state(balances: Record<string, string> = {}, orders: Record<string, SwapOrder> = {}, slot = 1): AssetState {
	return {
		...parseAssetState({ 'execution-device': 'token@1.0', 'total-supply': '1', balances, 'at-slot': slot }),
		orders,
	};
}

function assignment(action = 'payment') {
	return {
		slot: 2,
		blockHeight: 50,
		transactionIds: [transactionId],
		raw: {
			process: processId,
			body: {
				action,
				target: action === 'payment' ? seller.raw : processId,
				'order-id': orderId,
				quantity: '1000',
				recipient: buyer.host,
				commitments: {
					[transactionId]: {
						'commitment-device': 'tx@1.0',
						committer: action === 'payment' ? buyer.host : seller.host,
						'field-target': action === 'payment' ? seller.raw : processId,
						committed: ['order-id', 'quantity', 'target', 'action', 'recipient'],
						'original-tags': { 1: { name: 'quantity', value: '1000' } },
					},
				},
			},
		},
	};
}

describe('host-form account state boundaries', () => {
	it('parses host accounts without accepting host content IDs', () => {
		expect(parseSwapOrder(orderId, rawOrder())).toMatchObject({
			creator: seller.host,
			recipient: seller.host,
			buyer: buyer.host,
		});
		expect(parseSwapOrder(seller.host, { ...rawOrder(), 'order-id': seller.host })).toBeNull();
		for (const invalid of vectors.invalidHostAccounts) {
			expect(parseSwapOrder(orderId, { ...rawOrder(), creator: invalid })).toBeNull();
			expect(isBalanceIdentity(invalid)).toBe(false);
		}
	});

	it('reads host and raw balances with host precedence and exact case', () => {
		const current = state({ [seller.host]: '0', [seller.raw]: '9', [seller.raw.toLowerCase()]: '7' });
		expect(liquidBalanceOf(current, seller.raw)).toBe('0');
		expect(liquidBalanceOf(current, seller.host)).toBe('0');
		expect(liquidBalanceOf(state({ [seller.host]: '5' }), seller.raw)).toBe('5');
		expect(liquidBalanceOf(state({ [seller.raw]: '3' }), seller.host)).toBe('3');
		expect(liquidBalanceOf(current, seller.raw.toLowerCase())).toBe('7');
		expect(listedBalanceOf(state({}, { [orderId]: order() }), seller.raw)).toBe('1');
		expect(ownerOfAsset(state({ [seller.host]: '1' }))).toBe(seller.host);
		expect(ownerOfAsset(state({ [seller.raw]: '1', [seller.host]: '0', [buyer.host]: '1' }))).toBe(buyer.host);
	});

	it('combines liquid and escrow holdings for the same raw and host account', () => {
		const current = state(
			{ [seller.host]: '2', [seller.raw]: '1' },
			{
				[orderId]: order({ creator: seller.raw }),
			}
		);
		expect(fungibleHolders(current)).toEqual([{ address: seller.raw, liquid: '2', listed: '1', total: '3' }]);
		expect(fungibleHolders(state({ [seller.raw]: '1', [seller.host]: '0' }))).toEqual([]);
	});

	it('retains host accounts in linked maps and trie leaves', async () => {
		for (const root of [
			{ [seller.host]: '1' },
			{ device: 'trie@1.0', [seller.host.slice(0, 20)]: `ao:${'C'.repeat(43)}` },
		]) {
			const result = await readAssetState(processId, {
				provider: 'https://compute.example',
				fetch: async (input) => {
					const url = String(input);
					if (url.endsWith('/balances/device')) return new Response('message@1.0');
					const body = url.includes('B'.repeat(43))
						? root
						: url.includes('C'.repeat(43))
						? { [seller.host.slice(20)]: '1' }
						: { 'execution-device': 'token@1.0', 'total-supply': '1', balances: `ao:${'B'.repeat(43)}` };
					return Response.json(body, { headers: { 'codec-device': 'json@1.0' } });
				},
			});
			expect(result.state.balances).toEqual({ [seller.host]: '1' });
		}
	});

	it('keeps wallet market controls and raw browser recoveries usable after replay', () => {
		const expected = order({ creator: seller.raw, recipient: seller.raw });
		const current = state({}, { [orderId]: order() });
		expect(atomicOperationStateError('cancel', current, seller.raw, expected)).toBe('');
		expect(atomicOperationStateError('buy', current, seller.raw, expected)).toBe('market-state-changed');
		expect(fungibleOperationStateError('cancel', current, seller.raw, [expected])).toBe('');
		expect(operationRecoveryCanStillApply(current, seller.raw, { kind: 'cancel', order: expected }, 'atomic')).toBe(
			true
		);
		const reserved = state({}, { [orderId]: order({ status: 'reserved', buyer: buyer.host, reservedUntil: 100 }) });
		expect(atomicPurchaseRecoveryStatus(reserved, buyer.raw, expected)).toBe('resumable');
		expect(atomicPurchaseRecoveryCanBeDiscarded(reserved, buyer.raw, expected, {})).toBe(false);
	});

	it('matches raw activity actors against host reservations', () => {
		const raw = { ...rawOrder(), status: 'reserved' };
		const current = parseAssetState({
			'execution-device': 'token@1.0',
			'total-supply': '1',
			balances: {},
			orders: { [orderId]: raw },
		});
		expect(
			marketActivityReservation({ action: 'register-interest', actor: buyer.raw, orderId } as any, current)
		).toEqual({ deadline: 100, expired: false });
	});

	it('confirms offers and preflights host balances for a raw wallet', async () => {
		const client = new AssetTransactionClient({
			fetch: async () =>
				Response.json(
					{
						'execution-device': 'token@1.0',
						'total-supply': '1',
						balances: { [seller.host]: '1' },
						orders: { [orderId]: rawOrder() },
					},
					{ headers: { 'codec-device': 'json@1.0' } }
				),
		});
		await client.requireOpenOrder(processId, orderId, seller.raw);
		await client.requireAssetBalance(processId, seller.raw, '1');
		await client.waitForOfferAcceptance(processId, {
			orderId,
			seller: seller.raw,
			quantity: '1',
			asking: '1000',
			minimumFee: '0',
		});
	});

	it('captures dispatch baselines under raw recipients from host state', async () => {
		const plan = await createDispatchPlan(processId, seller.raw, [{ address: buyer.raw, quantity: '1' }], {
			fetch: async () =>
				Response.json(
					{
						'execution-device': 'token@1.0',
						'total-supply': '10',
						balances: { [seller.host]: '5', [buyer.host]: '2' },
					},
					{ headers: { 'codec-device': 'json@1.0' } }
				),
		});
		expect(plan.sender).toBe(seller.raw);
		expect(plan.baseline).toEqual({ [buyer.raw]: '2' });
	});
});

describe('host-form proof and receipt boundaries', () => {
	it('matches host committers while requiring a raw native payment target', () => {
		const proof = assignment();
		expect(() => assertExactPurchaseAssignment(proof, processId, transactionId, buyer.raw, order())).not.toThrow();
		proof.raw.body.commitments[transactionId]['field-target'] = seller.host;
		expect(() => assertExactPurchaseAssignment(proof, processId, transactionId, buyer.raw, order())).toThrow(
			'asset-purchase-proof-mismatch'
		);
	});

	it('observes purchase and cancellation credits across the replay cutover', () => {
		const reserved = order({ status: 'reserved', buyer: buyer.host, reservedUntil: 100 });
		expect(
			hasExactPurchaseTransition(
				state({ [buyer.raw]: '2' }, { [orderId]: reserved }),
				state({ [buyer.host]: '3' }, {}, 2),
				assignment(),
				buyer.raw,
				order()
			)
		).toBe(true);
		expect(
			hasExactCancelTransition(
				state({ [seller.raw]: '2' }, { [orderId]: order() }),
				state({ [seller.host]: '3' }, {}, 2),
				assignment('cancel-order'),
				seller.raw,
				order()
			)
		).toBe(true);
		expect(() =>
			assertExactCancelAssignment(assignment('cancel-order'), processId, transactionId, seller.raw, orderId)
		).not.toThrow();
	});

	it('compares transfer accounts and notices without converting process IDs', () => {
		expect(() =>
			assertExactFungibleTransferAssignment(
				assignment('transfer'),
				processId,
				transactionId,
				seller.raw,
				buyer.raw,
				'1000'
			)
		).not.toThrow();
		const after = state({}, {}, 2);
		after.raw.results = {
			outbox: [
				{ action: 'Debit-Notice', target: seller.host, recipient: buyer.host, quantity: '1000' },
				{ action: 'Credit-Notice', target: buyer.host, sender: seller.host, quantity: '1000' },
			],
		};
		expect(hasExactFungibleTransferReceipt(after, assignment('transfer'), seller.raw, buyer.raw, '1000')).toBe(
			true
		);
		expect(hasExactFungibleTransferReceipt(after, assignment('transfer'), buyer.raw, seller.raw, '1000')).toBe(
			false
		);
	});
});
