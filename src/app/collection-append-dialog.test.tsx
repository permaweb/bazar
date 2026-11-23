import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const dialogFocus = vi.hoisted(() => ({
	calls: [] as Array<[boolean, (() => void) | undefined, unknown]>,
}));

vi.mock('./useDialogFocus', async (importOriginal) => ({
	...(await importOriginal<typeof import('./useDialogFocus')>()),
	useDialogFocus: (active: boolean, onEscape?: () => void, restoreTarget?: unknown) => {
		dialogFocus.calls.push([active, onEscape, restoreTarget]);
		return { current: null };
	},
}));

import { CollectionAppendDialog } from './App';

const trigger = { id: 'add-assets-trigger' } as unknown as HTMLElement;

function render(overrides: Partial<React.ComponentProps<typeof CollectionAppendDialog>> = {}) {
	const onClose = vi.fn();
	const props: React.ComponentProps<typeof CollectionAppendDialog> = {
		collectionName: 'Colours',
		error: null,
		estimate: null,
		estimating: false,
		files: [],
		onClose,
		onSelectFiles: () => undefined,
		onSubmit: () => undefined,
		previews: [],
		restoreTargetRef: { current: trigger },
		status: '',
		working: false,
		...overrides,
	};
	const markup = renderToStaticMarkup(React.createElement(CollectionAppendDialog, props));
	const [active, onEscape, restoreTarget] = dialogFocus.calls[dialogFocus.calls.length - 1] ?? [];
	return { markup, onClose, active, onEscape, restoreTarget };
}

function statusRegion(markup: string) {
	return markup.match(/<span aria-atomic="true" role="status">([^<]*)<\/span>/)?.[1];
}

describe('CollectionAppendDialog', () => {
	beforeEach(() => {
		dialogFocus.calls.length = 0;
	});

	it('joins the shared dialog focus contract with a focusable modal container', () => {
		const { markup, active, onEscape, restoreTarget } = render();

		expect(active).toBe(true);
		expect(onEscape).toBeTypeOf('function');
		expect(restoreTarget).toBeTypeOf('function');
		expect((restoreTarget as () => HTMLElement | null)()).toBe(trigger);
		expect(markup).toMatch(/<section[^>]*aria-modal="true"[^>]*role="dialog"[^>]*tabindex="-1"/);
		expect(markup).toMatch(/<input[^>]*data-dialog-initial="true"[^>]*type="file"/);
	});

	it('closes on Escape only while no append is in progress', () => {
		const idle = render();
		idle.onEscape?.();
		expect(idle.onClose).toHaveBeenCalledTimes(1);

		const working = render({ working: true, status: 'Publishing manifest' });
		working.onEscape?.();
		expect(working.onClose).not.toHaveBeenCalled();
		expect(working.markup).toMatch(/<button[^>]*aria-label="Close add assets"[^>]*disabled=""/);
	});

	it('announces append phases politely without announcing the cost check', () => {
		const phase = 'Asset 2 of 5 · Approve in your wallet';
		const working = render({ working: true, status: phase });
		expect(statusRegion(working.markup)).toBe(phase);
		expect(working.markup).not.toContain('Ready');

		const estimating = render({ estimating: true });
		expect(statusRegion(estimating.markup)).toBe('');
		expect(estimating.markup).toContain('Checking Arweave storage cost…');

		const idle = render();
		expect(statusRegion(idle.markup)).toBe('');
		expect(idle.markup).toContain('Ready');
	});

	it('labels a failed append as a write failure, not a load failure', () => {
		const { markup } = render({ error: 'User rejected the request.' });

		expect(markup).toContain('role="alert"');
		expect(markup).toContain('Could not add assets');
		expect(markup).toContain('User rejected the request.');
		expect(markup).not.toContain('Unable to load');
	});

	it('shows keyboard focus on the dropzone that hides its file input', () => {
		const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

		expect(css).toMatch(
			/\.mint-dropzone:has\(> input:focus-visible\) \{\s*outline: 2px solid var\(--focus-ring\);/
		);
	});
});
