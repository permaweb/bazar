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
		estimate: { status: 'idle' },
		files: [],
		onClose,
		onRetryEstimate: () => undefined,
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

function submitButton(markup: string) {
	return markup.match(/<button[^>]*class="[^"]*\bwide\b[^"]*"[^>]*>/)?.[0] ?? '';
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

		const estimating = render({ estimate: { status: 'checking' } });
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

	it('never shows a total or an enabled submit while the cost is being re-checked', () => {
		const files = [
			new File(['a'], 'a.png', { type: 'image/png' }),
			new File(['b'], 'b.png', { type: 'image/png' }),
		];
		const ready = render({
			files,
			estimate: { status: 'ready', estimate: { assetCount: 2, total: 2_000_000_000_000n, transactionCount: 4 } },
		});
		expect(ready.markup).toContain('· 4 transactions</strong>');
		expect(submitButton(ready.markup)).not.toContain('disabled=""');

		const checking = render({ files, estimate: { status: 'checking' } });
		expect(checking.markup).toContain('Checking Arweave storage cost…');
		expect(checking.markup).not.toContain('transactions</strong>');
		expect(checking.markup).toContain('<strong>—</strong>');
		expect(submitButton(checking.markup)).toContain('disabled=""');
	});

	it('keeps a failed cost check apart from append failures and offers a retry', () => {
		const files = [new File(['a'], 'a.png', { type: 'image/png' })];
		const onRetryEstimate = vi.fn();
		const failed = render({ files, estimate: { status: 'failed', message: 'mint price 503' }, onRetryEstimate });

		expect(failed.markup).toContain('Could not check the storage cost');
		expect(failed.markup).toContain('mint price 503');
		expect(failed.markup).not.toContain('Could not add assets');
		expect(failed.markup).toContain('Storage cost unavailable');
		expect(failed.markup).toContain('<strong>—</strong>');
		expect(failed.markup).toContain('Retry cost check');
		expect(submitButton(failed.markup)).toContain('disabled=""');

		// An append failure with a fresh estimate still allows another attempt.
		const retryable = render({
			files,
			error: 'User rejected the request.',
			estimate: { status: 'ready', estimate: { assetCount: 1, total: 1_000_000_000_000n, transactionCount: 3 } },
		});
		expect(retryable.markup).toContain('Could not add assets');
		expect(retryable.markup).not.toContain('Retry cost check');
		expect(submitButton(retryable.markup)).not.toContain('disabled=""');
	});

	it('shows keyboard focus on the dropzone that hides its file input', () => {
		const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

		expect(css).toMatch(
			/\.mint-dropzone:has\(> input:focus-visible\) \{\s*outline: 2px solid var\(--focus-ring\);/
		);
	});
});
