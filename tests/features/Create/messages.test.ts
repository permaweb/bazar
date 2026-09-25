import { describe, expect, it } from 'vitest';

import { CREATE_MESSAGES } from 'features/Create/messages';

import { catalogUsage } from '../message-usage';

const usage = catalogUsage('src/features/Create', CREATE_MESSAGES.en);

describe('Create message catalog', () => {
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
