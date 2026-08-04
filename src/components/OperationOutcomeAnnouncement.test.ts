import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { OperationOutcomeAnnouncement } from './OperationOutcomeAnnouncement';

describe('operation outcome announcements', () => {
	it('announces only the concise completed outcome', () => {
		const outcome = renderToStaticMarkup(React.createElement(OperationOutcomeAnnouncement, {
			active: true,
			title: 'Purchase complete',
			detail: '8 WEAVE received from two listings.',
		}));
		expect(outcome).toContain('role="status"');
		expect(outcome).toContain('aria-atomic="true"');
		expect(outcome).toContain('Purchase complete');
		expect(outcome).not.toContain('<button');
		expect(outcome).not.toContain('<a');
	});

	it('exists empty before completion so later text is announced reliably', () => {
		const pending = renderToStaticMarkup(React.createElement(OperationOutcomeAnnouncement, {
			active: false,
			title: 'Transfer complete',
			detail: 'One token moved.',
		}));
		expect(pending).toContain('role="status"');
		expect(pending).not.toContain('Transfer complete');
		expect(pending).not.toContain('One token moved');
	});
});
