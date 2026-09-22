// @vitest-environment jsdom
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import StatusNotice from 'components/molecules/StatusNotice/StatusNotice';

import { axeViolations } from '../../../test-utils/accessibility';

describe('StatusNotice', () => {
	it('announces the message and renders actions and an optional dismiss control', () => {
		const markup = renderToStaticMarkup(
			<StatusNotice actions={<a href="#/asset">Review</a>} className="extra" onDismiss={() => undefined}>
				Tracking paused.
			</StatusNotice>
		);
		expect(markup).toContain('class="pending-operation-notice extra"');
		expect(markup).toContain('<span role="status">Tracking paused.</span><a href="#/asset">Review</a>');
		expect(markup).toContain('Dismiss</button>');
	});

	it('has no automated accessibility violations', async () => {
		expect(await axeViolations(<StatusNotice onDismiss={() => undefined}>Saved.</StatusNotice>)).toEqual([]);
	});
});
