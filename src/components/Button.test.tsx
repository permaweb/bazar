import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Button } from './Button';

describe('Button', () => {
	it('composes shared size and variant classes with native button props', () => {
		const markup = renderToStaticMarkup(
			<Button aria-current="page" className="extra" size="small" variant="primary">
				Current
			</Button>
		);

		expect(markup).toContain('ui-button ui-button--small ui-button--primary extra');
		expect(markup).toContain('aria-current="page"');
		expect(markup).toContain('type="button"');
	});

	it('exposes semantic appearance variants without legacy styling classes', () => {
		const markup = renderToStaticMarkup(
			<>
				<Button variant="neutral">Neutral</Button>
				<Button variant="ghost">Ghost</Button>
				<Button variant="danger">Danger</Button>
				<Button size="icon" aria-label="Close">
					×
				</Button>
			</>
		);

		expect(markup).toContain('ui-button--neutral');
		expect(markup).toContain('ui-button--ghost');
		expect(markup).toContain('ui-button--danger');
		expect(markup).toContain('ui-button--icon');
		expect(markup).not.toContain('class="primary');
	});
});
