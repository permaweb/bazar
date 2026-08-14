import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
	OperationOutcome,
	OperationOutcomeAnnouncement,
	OperationOutcomeSubject,
} from './OperationOutcomeAnnouncement';

describe('operation outcome announcements', () => {
	it('announces only the concise completed outcome', () => {
		const outcome = renderToStaticMarkup(
			React.createElement(OperationOutcomeAnnouncement, {
				active: true,
				title: 'Purchase complete',
				detail: '8 WEAVE received from two listings.',
			})
		);
		expect(outcome).toContain('role="status"');
		expect(outcome).toContain('aria-atomic="true"');
		expect(outcome).toContain('Purchase complete');
		expect(outcome).not.toContain('<button');
		expect(outcome).not.toContain('<a');
	});

	it('exists empty before completion so later text is announced reliably', () => {
		const pending = renderToStaticMarkup(
			React.createElement(OperationOutcomeAnnouncement, {
				active: false,
				title: 'Transfer complete',
				detail: 'One token moved.',
			})
		);
		expect(pending).toContain('role="status"');
		expect(pending).not.toContain('Transfer complete');
		expect(pending).not.toContain('One token moved');
	});

	it('places optional result media between the title and detail', () => {
		const outcome = renderToStaticMarkup(
			React.createElement(
				OperationOutcome,
				{ title: 'Listing is live', detail: 'catsun is offered for 0.0000002 AR.' },
				React.createElement('img', { alt: 'catsun artwork', src: '/catsun.png' })
			)
		);
		expect(outcome.indexOf('Listing is live')).toBeLessThan(outcome.indexOf('catsun artwork'));
		expect(outcome.indexOf('catsun artwork')).toBeLessThan(outcome.indexOf('catsun is offered'));
	});

	it('places a live confirmation count beside the completed title', () => {
		const outcome = renderToStaticMarkup(
			React.createElement(
				OperationOutcome,
				{
					title: 'Purchase complete',
					detail: 'The asset is now yours.',
					status: 'Confirmations: 4',
				},
				React.createElement('div', { className: 'network-view' }, 'Network view')
			)
		);
		expect(outcome).toContain('result-status-row');
		expect(outcome).toContain('Purchase complete');
		expect(outcome).toContain('Confirmations: 4');
		expect(outcome.indexOf('Purchase complete')).toBeLessThan(outcome.indexOf('Network view'));
	});

	it('names the item or value received in a completed outcome', () => {
		const subject = renderToStaticMarkup(
			React.createElement(OperationOutcomeSubject, {
				label: 'You received',
				title: '0.11 AR',
				detail: 'For tSteelBlue',
				media: React.createElement('img', { alt: 'tSteelBlue artwork', src: '/tsteelblue.png' }),
			})
		);
		expect(subject).toContain('You received');
		expect(subject).toContain('tSteelBlue artwork');
		expect(subject).toContain('ar-currency-label');
		expect(subject).toContain('For tSteelBlue');
	});
});
