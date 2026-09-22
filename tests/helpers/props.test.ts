import { describe, expect, it } from 'vitest';

import { omitProps } from 'helpers/props';

describe('omitProps', () => {
	it('returns a copy without the listed keys and leaves the source untouched', () => {
		const props = { id: 'x', size: 'small', variant: 'ghost', title: 'Close' } as const;
		const rest = omitProps(props, ['size', 'variant']);
		expect(rest).toEqual({ id: 'x', title: 'Close' });
		expect(props).toEqual({ id: 'x', size: 'small', variant: 'ghost', title: 'Close' });
	});
});
