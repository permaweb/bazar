import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Tooltip, TooltipSurface } from './Tooltip';

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

	it('uses the same visible surface for dynamically positioned inspectors', () => {
		const markup = renderToStaticMarkup(
			<TooltipSurface id="inspection" visible>
				Observer details
			</TooltipSurface>
		);

		expect(markup).toContain('ui-tooltip__content ui-tooltip__content--visible');
		expect(markup).toContain('role="tooltip"');
	});

	it('can suppress an anchored tooltip while its trigger opens another surface', () => {
		const markup = renderToStaticMarkup(
			<Tooltip content="Activity" disabled>
				{(tooltipId) => <button aria-describedby={tooltipId}>Open</button>}
			</Tooltip>
		);

		expect(markup).toContain('ui-tooltip--disabled');
	});

	it('supports centered delayed hover labels without delaying keyboard semantics', () => {
		const markup = renderToStaticMarkup(
			<Tooltip align="center" content="Portal" delayMs={1000}>
				{(tooltipId) => <button aria-describedby={tooltipId}>Open</button>}
			</Tooltip>
		);

		expect(markup).toContain('ui-tooltip--align-center');
		expect(markup).toContain('--ui-tooltip-delay:1000ms');
	});
});
