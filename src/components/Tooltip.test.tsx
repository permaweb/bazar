import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Tooltip } from './Tooltip';

describe('Tooltip', () => {
	it('links reusable trigger content to a bottom tooltip', () => {
		const markup = renderToStaticMarkup(
			<Tooltip content="Reusable context">
				{(tooltipId) => <button aria-describedby={tooltipId}>Info</button>}
			</Tooltip>
		);

		const tooltipId = markup.match(/aria-describedby="([^"]+)"/)?.[1];

		expect(tooltipId).toBeTruthy();
		expect(markup).toContain('ui-tooltip ui-tooltip--bottom');
		expect(markup).toContain(`id="${tooltipId}"`);
		expect(markup).toContain('role="tooltip"');
		expect(markup).toContain('Reusable context');
	});

	it('supports top placement when another surface needs it', () => {
		const markup = renderToStaticMarkup(
			<Tooltip content="Above" placement="top">
				{(tooltipId) => <button aria-describedby={tooltipId}>Info</button>}
			</Tooltip>
		);

		expect(markup).toContain('ui-tooltip--top');
	});
});
