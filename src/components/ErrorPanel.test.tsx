import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ErrorPanel } from './ErrorPanel';

describe('ErrorPanel', () => {
	it('keeps the supplied diagnostic visible beside retry controls', () => {
		const message = 'The configured AO peers did not return live state within 45 seconds.';
		const markup = renderToStaticMarkup(
			<ErrorPanel
				message={message}
				onRetry={vi.fn()}
				secondaryAction={{ label: 'Use Bazar peers', onClick: vi.fn() }}
			/>
		);

		expect(markup).toContain(message);
		expect(markup).toContain('Retry');
		expect(markup).toContain('Use Bazar peers');
		expect(markup).not.toContain('Please try again.');
	});
});
