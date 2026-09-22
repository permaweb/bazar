import { describe, expect, it } from 'vitest';

import { DISPATCH_SIGNED_TRANSACTION_RECOVERY_REQUIRED } from 'api/dispatch';
import { DISPLAY_STATE_TIMEOUT_ERROR } from 'api/marketplace';

import { dispatchErrorMessage } from 'features/Dispatch/components/organisms/HolderDispatch/HolderDispatch';

describe('dispatch recovery errors', () => {
	it('explains why a missing signed transaction requires manual review instead of replacement', () => {
		const message = dispatchErrorMessage(new Error(DISPATCH_SIGNED_TRANSACTION_RECOVERY_REQUIRED));

		expect(message).toContain('may already have reached Arweave');
		expect(message).toContain('will not sign a replacement');
		expect(message).toContain('manual review');
	});

	it('explains that a state-read deadline cannot create another signature', () => {
		const message = dispatchErrorMessage(new Error(DISPLAY_STATE_TIMEOUT_ERROR));

		expect(message).toContain('within 45 seconds');
		expect(message).toContain('No new transfer was signed');
		expect(message).toContain('saved dispatch progress remains available');
	});
});
