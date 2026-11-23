import { describe, expect, it } from 'vitest';

import { mintErrorMessage } from './App';

describe('mintErrorMessage', () => {
	it('explains exhausted uploads without dashed error codes', () => {
		const copy =
			'The gateway did not accept the upload. Check your connection and try again; your earlier uploads are kept.';
		expect(mintErrorMessage(new Error('mint-upload-network'))).toBe(copy);
		expect(mintErrorMessage(new Error('mint-upload-503'))).toBe(copy);
	});
});
