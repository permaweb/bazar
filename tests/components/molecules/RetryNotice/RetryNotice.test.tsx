// @vitest-environment jsdom
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import RetryNotice from 'components/molecules/RetryNotice/RetryNotice';
import { ASSET_DETAIL_MESSAGES } from 'features/AssetDetail/messages';

import { axeViolations } from '../../../test-utils/accessibility';

const language = ASSET_DETAIL_MESSAGES.en;

describe('RetryNotice', () => {
	it('announces the caller’s message outside the retry control', () => {
		const markup = renderToStaticMarkup(
			<RetryNotice onRetry={() => undefined} retryLabel={language.uniqueActivityRetryLabel}>
				{language.uniqueActivityRetry}
			</RetryNotice>
		);
		expect(markup).toContain(`<span role="status">${language.uniqueActivityRetry}</span>`);
		expect(markup).toContain('class="inline-error retry-notice"');
		expect(markup).toContain('type="button"');
		expect(markup).toContain(`${language.uniqueActivityRetryLabel}</button>`);
	});

	it('supports custom copy, labels, and a busy retry state', () => {
		const markup = renderToStaticMarkup(
			<RetryNotice onRetry={() => undefined} retryLabel={language.fungibleActivityRetryLabel} retrying>
				{language.fungibleActivityRetryPrevious}
			</RetryNotice>
		);
		expect(markup).toContain(language.fungibleActivityRetryPrevious);
		expect(markup).toContain('disabled=""');
		expect(markup).toContain(language.fungibleActivityRetryLabel);
	});

	it('has no automated accessibility violations', async () => {
		expect(
			await axeViolations(
				<RetryNotice onRetry={() => undefined} retryLabel={language.uniqueActivityRetryLabel}>
					{language.uniqueActivityRetry}
				</RetryNotice>
			)
		).toEqual([]);
	});
});
