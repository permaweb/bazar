import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import AssetBalanceStateNotice from 'features/Operations/components/molecules/AssetBalanceStateNotice/AssetBalanceStateNotice';

describe('incomplete balance state notice', () => {
	it('explains why new mutations are paused without blocking signed recovery', () => {
		const markup = renderToStaticMarkup(<AssetBalanceStateNotice state={{ holderBalancesAvailable: false }} />);

		expect(markup).toContain('role="status"');
		expect(markup).toContain('Balance state incomplete');
		expect(markup).toContain('purchases, listings, cancellations, transfers');
		expect(markup).toContain('Saved signed actions remain available for recovery');
	});

	it('renders nothing when the balance table is complete', () => {
		expect(renderToStaticMarkup(<AssetBalanceStateNotice state={{ holderBalancesAvailable: true }} />)).toBe('');
		expect(renderToStaticMarkup(<AssetBalanceStateNotice state={{}} />)).toBe('');
	});
});
