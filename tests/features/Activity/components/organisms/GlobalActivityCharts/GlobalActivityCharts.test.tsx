// @vitest-environment jsdom
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { CollectionActivityEvent } from 'api/discovery';

import GlobalActivityCharts from 'features/Activity/components/organisms/GlobalActivityCharts/GlobalActivityCharts';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const event = (
	id: string,
	action: CollectionActivityEvent['action'],
	actor: string,
	timestamp: number
): CollectionActivityEvent => ({
	id,
	processId: 'P'.repeat(43),
	action,
	actor,
	height: timestamp,
	timestamp,
});

let host: HTMLElement;
let root: Root;

beforeEach(() => {
	host = document.createElement('div');
	document.body.append(host);
	root = createRoot(host);
});

afterEach(() => {
	React.act(() => root.unmount());
	host.remove();
});

describe('GlobalActivityCharts', () => {
	it('renders keyboard-inspectable charts and naturally spaced rolling counters', () => {
		const markup = renderToStaticMarkup(
			<GlobalActivityCharts events={[event('listing', 'make-offer', 'wallet-a', 24 * 60 * 60)]} />
		);

		expect(markup.match(/role="img"/g)).toHaveLength(3);
		expect(markup).toContain('Focus and use arrow keys to inspect values.');
		expect(markup).toContain('global-activity-counter-value');
		expect(markup).not.toContain('global-activity-counter-digit');
	});

	it('keeps a focused chart readable when its history is cleared', () => {
		React.act(() =>
			root.render(<GlobalActivityCharts events={[event('listing', 'make-offer', 'wallet-a', 24 * 60 * 60)]} />)
		);
		const chart = host.querySelector<HTMLElement>('[role="img"]');
		React.act(() => chart?.focus());
		expect(chart?.getAttribute('aria-label')).toMatch(/: 1 events\.$/);

		React.act(() => root.render(<GlobalActivityCharts events={[]} />));

		expect(host.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe(
			'Events over time. Focus and use arrow keys to inspect values.'
		);
	});
});
