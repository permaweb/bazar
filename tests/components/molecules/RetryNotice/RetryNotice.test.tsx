// @vitest-environment jsdom
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import RetryNotice, { COMPUTE_RETRY_MESSAGE } from 'components/molecules/RetryNotice/RetryNotice';

import { axeViolations } from '../../../test-utils/accessibility';

describe('RetryNotice', () => {
	it('announces the default compute message outside the retry control', () => {
		const markup = renderToStaticMarkup(<RetryNotice onRetry={() => undefined} />);
		expect(markup).toContain(`<span role="status">${COMPUTE_RETRY_MESSAGE}</span>`);
		expect(markup).toContain('class="inline-error retry-notice"');
		expect(markup).toContain('type="button"');
		expect(markup).toContain('Retry</button>');
	});

	it('supports custom copy, labels, and a busy retry state', () => {
		const markup = renderToStaticMarkup(
			<RetryNotice onRetry={() => undefined} retryLabel="Retry history" retrying>
				Events could not be loaded.
			</RetryNotice>
		);
		expect(markup).toContain('Events could not be loaded.');
		expect(markup).toContain('disabled=""');
		expect(markup).toContain('Retry history');
	});

	it('has no automated accessibility violations', async () => {
		expect(await axeViolations(<RetryNotice onRetry={() => undefined} />)).toEqual([]);
	});
});
