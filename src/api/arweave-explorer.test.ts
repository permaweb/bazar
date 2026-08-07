import { describe, expect, it } from 'vitest';

import { transactionExplorerUrl } from './arweave-explorer';

describe('Arweave explorer links', () => {
	it('opens submitted transactions in a metadata explorer instead of raw data', () => {
		expect(transactionExplorerUrl('transaction_id')).toBe('https://viewblock.io/arweave/tx/transaction_id');
	});
});
