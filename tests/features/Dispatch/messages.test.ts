import { describe, expect, it } from 'vitest';

import { DISPATCH_MESSAGES } from 'features/Dispatch/messages';

import { catalogUsage } from '../message-usage';

const usage = catalogUsage('src/features/Dispatch', DISPATCH_MESSAGES.en);

describe('Dispatch message catalog', () => {
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
