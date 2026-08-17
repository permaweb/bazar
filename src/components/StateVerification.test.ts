import { describe, expect, it } from 'vitest';

import { stateVerificationTimeLabel } from './StateVerification';

describe('state verification timestamp', () => {
	it('always includes the date so a visible tab remains unambiguous across midnight', () => {
		const checked = new Date(2026, 7, 3, 11, 20, 10).getTime();
		expect(stateVerificationTimeLabel(checked)).toContain('2026');
	});
});
