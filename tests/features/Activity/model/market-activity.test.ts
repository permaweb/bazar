import { describe, expect, it } from 'vitest';

import type { CollectionActivityEvent } from 'api/discovery';
import { parseAssetState } from 'api/marketplace';

import {
	formatMarketActivityTimestamp,
	marketActivityDetail,
	marketActivityLabel,
	marketActivityRefreshDelay,
	marketActivityReservation,
	marketActivityRow,
} from 'features/Activity/model/market-activity';

const seller = '1uTLV5GvfQ5M46Tq_DTeJL7rIy7vCAOMxQ7Fbf82YZw';
const buyer = 'BLyLiOZptmb-olB8wycvk_ynHiu1SZMKPqswx4KONwc';
const orderId = 'qAhWNMSuX70lZpIRohKJn_SuVcymr_RmpGbltydjpwA';
const processId = 'IyFfmbTu8P4rv0KyrA0Q-QtfEnYntMj4RkRiBVip9KA';
const NOW = Date.UTC(2026, 7, 7, 16, 35, 12);

function reservedState(height: number, reservedBuyer = buyer) {
	return parseAssetState(
		{
			'execution-device': 'token@1.0',
			'total-supply': '1',
			balances: {},
			orders: {
				[orderId]: {
					'order-id': orderId,
					creator: seller,
					recipient: seller,
					asking: '1000000000000',
					deadline: 200,
					'created-at': 100,
					quantity: 1,
					status: 'reserved',
					buyer: reservedBuyer,
					'reserved-until': 120,
				},
			},
			'swap-height': 100,
		},
		height
	);
}

const registration: CollectionActivityEvent = {
	action: 'register-interest',
	actor: buyer,
	height: 110,
	id: 'registration',
	orderId,
	processId,
	timestamp: 1,
};

describe('market activity labels', () => {
	it('presents a purchase reservation as a submitted purchase', () => {
		expect(marketActivityLabel('register-interest')).toBe('Purchase submitted');
		expect(marketActivityLabel('register-interest', true)).toBe('Purchase confirmed');
		expect(marketActivityLabel('make-offer')).toBe('Listing submitted');
		expect(marketActivityLabel('transfer')).toBe('Transfer submitted');
		expect(marketActivityLabel('cancel-order')).toBe('Cancellation submitted');
	});

	it('describes each action from its own fields and nothing else', () => {
		const base = { actor: buyer, height: 1, id: 'event', processId, timestamp: 1 };
		expect(marketActivityDetail({ ...base, action: 'make-offer', asking: '1500000000000' })).toBe('1.5 AR total');
		expect(marketActivityDetail({ ...base, action: 'transfer', recipient: seller })).toBe('To 1uTLV5…82YZw');
		expect(marketActivityDetail({ ...base, action: 'register-interest', orderId })).toBe('Order qAhWNM…djpwA');
		expect(marketActivityDetail({ ...base, action: 'cancel-order', orderId })).toBe('Order qAhWNM…djpwA');
		expect(marketActivityDetail({ ...base, action: 'make-offer' })).toBe('');
		expect(marketActivityDetail({ ...base, action: 'transfer' })).toBe('');
	});
});

describe('market activity reservations', () => {
	it('reports the reservation deadline until the payment window passes', () => {
		expect(marketActivityReservation(registration, reservedState(120))).toEqual({ deadline: 120, expired: false });
		expect(marketActivityReservation(registration, reservedState(121))).toEqual({ deadline: 120, expired: true });
	});

	it('ignores reservations held by another buyer, settled purchases, and missing state', () => {
		expect(marketActivityReservation(registration, reservedState(120, seller))).toBeNull();
		expect(
			marketActivityReservation(
				{ ...registration, purchaseProof: { transactionId: 'settlement', height: 121 } },
				reservedState(120)
			)
		).toBeNull();
		expect(marketActivityReservation(registration, null)).toBeNull();
		expect(marketActivityReservation({ ...registration, action: 'transfer' }, reservedState(120))).toBeNull();
	});
});

describe('market activity rows', () => {
	it('builds the headline, detail, timestamps, and settlement link for one event', () => {
		const row = marketActivityRow(
			{
				...registration,
				timestamp: (NOW - 60_000) / 1_000,
				purchaseProof: { transactionId: 'settlement', height: 1_234 },
			},
			{ now: NOW, collection: { id: 'collection', name: 'Atomic art' } }
		);

		expect(row).toMatchObject({
			reservation: null,
			label: 'Purchase confirmed',
			detail: 'Atomic art · Order qAhWNM…djpwA',
			amount: '',
			assetCollectionId: 'collection',
			transactionId: 'settlement',
			transactionHeight: 1_234,
			timestamp: '1 minute ago',
			timestampDateTime: new Date(NOW - 60_000).toISOString(),
			transactionLabel: 'View settlement proof included in block 1,234',
			transactionSummary: 'View settlement proof · included in block 1,234',
		});
		expect(row.absoluteTimestamp).toBeTruthy();
	});

	it('uses caller formatters and marks unconfirmed events as pending', () => {
		const row = marketActivityRow(
			{ ...registration, height: 0, timestamp: 0 },
			{ now: NOW, collectionId: 'fallback', describeEvent: () => 'custom', eventAmount: () => '12 TOKEN' }
		);

		expect(row).toMatchObject({
			detail: 'custom',
			amount: '12 TOKEN',
			assetCollectionId: 'fallback',
			transactionId: 'registration',
			timestamp: 'Pending confirmation',
			absoluteTimestamp: undefined,
			timestampDateTime: undefined,
			transactionLabel: 'View submitted transaction',
			transactionSummary: 'View submitted transaction',
		});
	});
});

describe('market activity time', () => {
	it('formats activity timestamps as live relative time', () => {
		expect(formatMarketActivityTimestamp((NOW - 1_000) / 1_000, NOW)).toBe('1 second ago');
		expect(formatMarketActivityTimestamp((NOW - 59_000) / 1_000, NOW)).toBe('59 seconds ago');
		expect(formatMarketActivityTimestamp((NOW - 60_000) / 1_000, NOW)).toBe('1 minute ago');
		expect(formatMarketActivityTimestamp((NOW - 3_600_000) / 1_000, NOW)).toBe('1 hour ago');
		expect(formatMarketActivityTimestamp((NOW - 86_400_000) / 1_000, NOW)).toBe('1 day ago');
		expect(formatMarketActivityTimestamp((NOW - 7 * 86_400_000) / 1_000, NOW)).toBe('1 week ago');
		expect(formatMarketActivityTimestamp((NOW - 30 * 86_400_000) / 1_000, NOW)).toBe('1 month ago');
		expect(formatMarketActivityTimestamp((NOW - 365 * 86_400_000) / 1_000, NOW)).toBe('1 year ago');
	});

	it('updates only at the next visible relative-time boundary', () => {
		const current = Date.UTC(2026, 7, 7, 16, 35, 12, 500);
		const event = (elapsed: number): CollectionActivityEvent => ({
			...registration,
			timestamp: (current - elapsed) / 1_000,
		});

		expect(marketActivityRefreshDelay([event(2_500)], current)).toBe(520);
		expect(marketActivityRefreshDelay([event(90_500)], current)).toBe(29_520);
		expect(marketActivityRefreshDelay([event(7_200_500)], current)).toBe(3_599_520);
		expect(marketActivityRefreshDelay([event(172_800_500)], current)).toBe(86_399_520);
		expect(marketActivityRefreshDelay([event(2_500), event(90_500)], current)).toBe(520);
		expect(marketActivityRefreshDelay([{ ...registration, timestamp: 0 }], current)).toBeNull();
		expect(marketActivityRefreshDelay([], current)).toBeNull();
	});
});
