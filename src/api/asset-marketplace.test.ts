import { describe, expect, it } from 'vitest';

import {
	ownerOfAsset,
	parseAssetState,
	servingNodeOrigin,
} from './asset-marketplace';

const owner = '1uTLV5GvfQ5M46Tq_DTeJL7rIy7vCAOMxQ7Fbf82YZw';
const buyer = 'BLyLiOZptmb-olB8wycvk_ynHiu1SZMKPqswx4KONwc';
const orderId = 'qAhWNMSuX70lZpIRohKJn_SuVcymr_RmpGbltydjpwA';

describe('servingNodeOrigin', () => {
	it('removes only an Arweave security sandbox label', () => {
		expect(servingNodeOrigin({
			protocol: 'https:',
			hostname: 'lcno4nkkk4gsb5krqpa6irlzbuurmnzk4entikswauifsbryldfa.charlie.neo2.zephyrdev.xyz',
		})).toBe('https://charlie.neo2.zephyrdev.xyz');
	});

	it('preserves ordinary multi-label gateway hosts', () => {
		expect(servingNodeOrigin({
			protocol: 'https:',
			hostname: 'charlie.neo2.zephyrdev.xyz',
		})).toBe('https://charlie.neo2.zephyrdev.xyz');
	});

	it('uses Arweave for localhost unless an explicit node is selected', () => {
		expect(servingNodeOrigin({ protocol: 'http:', hostname: '127.0.0.1', port: '3000' }))
			.toBe('https://arweave.net');
		expect(servingNodeOrigin({
			protocol: 'http:',
			hostname: '127.0.0.1',
			port: '3000',
			search: '?node=http%3A%2F%2F127.0.0.1%3A3101',
		})).toBe('http://127.0.0.1:3101');
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

	it('rejects a process that is not a one-unit supported asset', () => {
		expect(() => parseAssetState({
			'execution-device': 'token@1.0',
			'total-supply': 2,
			balances: { [owner]: '2' },
		})).toThrow('invalid-asset-state');
	});
});
