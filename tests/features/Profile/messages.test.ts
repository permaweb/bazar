import { describe, expect, it } from 'vitest';

import { PROFILE_MESSAGES } from 'features/Profile/messages';

import { catalogUsage } from '../message-usage';

const usage = catalogUsage('src/features/Profile', PROFILE_MESSAGES.en);

describe('Profile message catalog', () => {
	it('resolves every key the feature reads', () => {
		expect(usage.unknown).toEqual([]);
	});

	it('keeps no message the feature never renders', () => {
		expect(usage.unused).toEqual([]);
	});

	it('passes exactly the placeholders each template declares', () => {
		expect(usage.placeholderMismatches).toEqual([]);
	});
});
