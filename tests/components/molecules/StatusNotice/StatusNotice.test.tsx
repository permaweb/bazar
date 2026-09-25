// @vitest-environment jsdom
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import StatusNotice from 'components/molecules/StatusNotice/StatusNotice';
import { ASSET_DETAIL_MESSAGES } from 'features/AssetDetail/messages';

import { axeViolations } from '../../../test-utils/accessibility';

const language = ASSET_DETAIL_MESSAGES.en;

describe('StatusNotice', () => {
	it('announces the message and renders actions and an optional dismiss control', () => {
		const markup = renderToStaticMarkup(
			<StatusNotice
				actions={<a href="#/asset">Review</a>}
				className="extra"
				dismissLabel={language.assetDetailNoticeDismiss}
				onDismiss={() => undefined}
			>
				Tracking paused.
			</StatusNotice>
		);
		expect(markup).toContain('class="pending-operation-notice extra"');
		expect(markup).toContain('<span role="status">Tracking paused.</span><a href="#/asset">Review</a>');
		expect(markup).toContain(`${language.assetDetailNoticeDismiss}</button>`);
	});

	it('has no automated accessibility violations', async () => {
		expect(
			await axeViolations(
				<StatusNotice dismissLabel={language.assetDetailNoticeDismiss} onDismiss={() => undefined}>
					Saved.
				</StatusNotice>
			)
		).toEqual([]);
	});
});
