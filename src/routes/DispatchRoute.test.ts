import { describe, expect, it } from 'vitest';

import { DISPATCH_SIGNED_TRANSACTION_RECOVERY_REQUIRED } from 'api/fungible-dispatch';

import { dispatchErrorMessage } from './DispatchRoute';

describe('dispatch recovery errors', () => {
	it('explains why a missing signed transaction requires manual review instead of replacement', () => {
		const message = dispatchErrorMessage(new Error(DISPATCH_SIGNED_TRANSACTION_RECOVERY_REQUIRED));

		expect(message).toContain('may already have reached Arweave');
		expect(message).toContain('will not sign a replacement');
		expect(message).toContain('manual review');
	});
});
