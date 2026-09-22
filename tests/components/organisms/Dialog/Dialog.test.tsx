// @vitest-environment jsdom
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Dialog, isModalDialogOpen } from 'components/organisms/Dialog';

import { axeViolations } from '../../../test-utils/accessibility';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Options = Partial<Omit<React.ComponentProps<typeof Dialog>, 'children'>> & { initial?: boolean };

let root: Root;
let host: HTMLElement;
let background: HTMLElement;
let onDismiss: ReturnType<typeof vi.fn>;

function dialog(options: Options = {}) {
	return (
		<Dialog
			backdropClassName="dialog-backdrop"
			className="dialog dialog-compact"
			labelledBy="dialog-test-title"
			onDismiss={onDismiss}
			open
			{...options}
		>
			<h2 id="dialog-test-title">Edit profile</h2>
			<button type="button">First</button>
			<button data-dialog-initial={options.initial === false ? undefined : true} type="button">
				Initial
			</button>
			<button type="button">Last</button>
		</Dialog>
	);
}

function render(options: Options = {}) {
	React.act(() => root.render(dialog(options)));
}

function button(label: string) {
	const match = [...document.querySelectorAll('button')].find((element) => element.textContent === label);
	if (!match) throw new Error(`Missing button ${label}`);
	return match;
}

function panel() {
	return host.querySelector<HTMLElement>('.dialog');
}

function backdrop() {
	return host.querySelector<HTMLElement>('.dialog-backdrop');
}

function press(key: string, options: KeyboardEventInit = {}) {
	const target = document.activeElement ?? document.body;
	const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key, ...options });
	React.act(() => {
		target.dispatchEvent(event);
	});
	return event;
}

function mouseDown(target: Element) {
	React.act(() => {
		target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
	});
}

function nextFrame() {
	return new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
}

beforeEach(() => {
	onDismiss = vi.fn();
	window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
	// jsdom has no layout; treat connected elements outside a hidden subtree as rendered.
	vi.spyOn(HTMLElement.prototype, 'getClientRects').mockImplementation(function (this: HTMLElement) {
		return (this.isConnected && !this.closest('[hidden]') ? [{}] : []) as unknown as DOMRectList;
	});
	background = document.createElement('div');
	background.innerHTML =
		'<button type="button" id="opener">Open</button><button type="button" id="fallback">Fallback</button>';
	host = document.createElement('div');
	document.body.append(background, host);
	root = createRoot(host);
});

afterEach(async () => {
	React.act(() => root.unmount());
	await nextFrame();
	background.remove();
	host.remove();
	vi.restoreAllMocks();
});

describe('Dialog', () => {
	it('renders caller class names with modal dialog semantics', () => {
		render({ as: 'section', id: 'profile-dialog' });
		expect(host.innerHTML).toMatch(/^<div class="dialog-backdrop" role="presentation"><section /);
		expect(panel()?.tagName).toBe('SECTION');
		expect(panel()?.getAttribute('role')).toBe('dialog');
		expect(panel()?.getAttribute('aria-modal')).toBe('true');
		expect(panel()?.getAttribute('aria-labelledby')).toBe('dialog-test-title');
		expect(panel()?.getAttribute('tabindex')).toBe('-1');
		expect(panel()?.id).toBe('profile-dialog');
		expect(backdrop()?.hasAttribute('hidden')).toBe(false);
		expect(isModalDialogOpen()).toBe(true);
	});

	it('renders nothing while a modal dialog is closed', () => {
		render({ open: false });
		expect(host.innerHTML).toBe('');
		expect(isModalDialogOpen()).toBe(false);
	});

	it('has no automated accessibility violations', async () => {
		React.act(() => root.unmount());
		root = createRoot(host);
		expect(await axeViolations(dialog())).toEqual([]);
		expect(await axeViolations(dialog({ as: 'section', label: 'Search Bazar', labelledBy: undefined }))).toEqual(
			[]
		);
	});

	it('moves focus to the marked initial control, then the first control, then the panel', () => {
		render();
		expect(document.activeElement).toBe(button('Initial'));
		React.act(() => root.unmount());
		root = createRoot(host);
		render({ initial: false });
		expect(document.activeElement).toBe(button('First'));
		React.act(() => root.unmount());
		root = createRoot(host);
		React.act(() =>
			root.render(
				<Dialog
					backdropClassName="dialog-backdrop"
					className="dialog"
					label="Notice"
					onDismiss={onDismiss}
					open
				>
					<p>Nothing to focus.</p>
				</Dialog>
			)
		);
		expect(document.activeElement).toBe(panel());
	});

	it('contains Tab and Shift+Tab within the dialog', () => {
		render();
		button('Last').focus();
		const forward = press('Tab');
		expect(forward.defaultPrevented).toBe(true);
		expect(document.activeElement).toBe(button('First'));

		const backward = press('Tab', { shiftKey: true });
		expect(backward.defaultPrevented).toBe(true);
		expect(document.activeElement).toBe(button('Last'));

		button('Initial').focus();
		expect(press('Tab').defaultPrevented).toBe(false);

		document.body.focus();
		(document.activeElement as HTMLElement | null)?.blur();
		const reentry = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Tab' });
		React.act(() => {
			document.body.dispatchEvent(reentry);
		});
		expect(reentry.defaultPrevented).toBe(true);
		expect(document.activeElement).toBe(button('First'));
	});

	it('dismisses on Escape unless a control inside owns Escape', () => {
		render();
		expect(press('Escape').defaultPrevented).toBe(true);
		expect(onDismiss).toHaveBeenCalledTimes(1);

		button('First').setAttribute('data-dialog-escape-owner', '');
		button('First').focus();
		press('Escape');
		expect(onDismiss).toHaveBeenCalledTimes(1);
	});

	it('dismisses on a backdrop mousedown but not on a mousedown inside the panel', () => {
		render();
		mouseDown(button('First'));
		mouseDown(panel() as HTMLElement);
		expect(onDismiss).not.toHaveBeenCalled();
		mouseDown(backdrop() as HTMLElement);
		expect(onDismiss).toHaveBeenCalledTimes(1);
	});

	it('isolates the background while open and releases it on close', () => {
		render();
		expect(background.inert).toBe(true);
		render({ open: false });
		// jsdom has no native `inert`, so release restores the original (absent) value.
		expect(background.inert).toBeFalsy();
	});

	it('restores focus to the element that opened it', async () => {
		render({ open: false });
		const opener = document.getElementById('opener') as HTMLElement;
		opener.focus();
		render({ open: true, restoreTarget: () => opener });
		expect(document.activeElement).toBe(button('Initial'));
		render({ open: false, restoreTarget: () => opener });
		await nextFrame();
		expect(document.activeElement).toBe(opener);
	});

	it('restores focus to the element focused when the dialog mounted if no target is given', async () => {
		const opener = document.getElementById('opener') as HTMLElement;
		opener.focus();
		render({ open: false });
		render({ open: true });
		expect(document.activeElement).toBe(button('Initial'));
		render({ open: false });
		await nextFrame();
		expect(document.activeElement).toBe(opener);
	});

	it('falls back when the restore target is no longer available', async () => {
		const opener = document.getElementById('opener') as HTMLButtonElement;
		const fallback = document.getElementById('fallback') as HTMLElement;
		render({ restoreFallback: () => fallback, restoreTarget: () => opener });
		opener.disabled = true;
		render({ open: false, restoreFallback: () => fallback, restoreTarget: () => opener });
		await nextFrame();
		expect(document.activeElement).toBe(fallback);
	});

	it('keeps focus in place when a caller re-renders with new callbacks, and refocuses on a new focus key', () => {
		render({ focusKey: 'form', restoreTarget: () => null });
		button('Last').focus();
		render({ focusKey: 'form', restoreTarget: () => null });
		expect(document.activeElement).toBe(button('Last'));
		render({ focusKey: 'working', restoreTarget: () => null });
		expect(document.activeElement).toBe(button('Initial'));
	});

	it('exposes the panel element to callers', () => {
		const panelRef: React.MutableRefObject<HTMLElement | null> = { current: null };
		render({ panelRef });
		expect(panelRef.current).toBe(panel());
		render({ open: false, panelRef });
		expect(panelRef.current).toBeNull();
	});

	it('keeps a persistent side panel mounted but hidden without dialog semantics', () => {
		render({ keepMounted: true, open: false });
		expect(backdrop()?.hasAttribute('hidden')).toBe(true);
		expect(panel()?.getAttribute('aria-hidden')).toBe('true');
		expect(panel()?.hasAttribute('role')).toBe(false);
		expect(panel()?.hasAttribute('aria-modal')).toBe(false);
		expect(panel()?.hasAttribute('aria-labelledby')).toBe(false);
		expect(background.inert).toBeFalsy();
		expect(isModalDialogOpen()).toBe(false);

		render({ keepMounted: true, open: true });
		expect(backdrop()?.hasAttribute('hidden')).toBe(false);
		expect(panel()?.hasAttribute('aria-hidden')).toBe(false);
		expect(panel()?.getAttribute('role')).toBe('dialog');
		expect(panel()?.getAttribute('aria-modal')).toBe('true');
		expect(panel()?.getAttribute('aria-labelledby')).toBe('dialog-test-title');
		expect(document.activeElement).toBe(button('Initial'));
		expect(isModalDialogOpen()).toBe(true);
	});

	it('marks the side panel exit animation on the backdrop', () => {
		render({ backdropClassName: 'dialog-backdrop operation-panel-backdrop', hiding: true, keepMounted: true });
		expect(backdrop()?.className).toBe('dialog-backdrop operation-panel-backdrop dialog-backdrop-hiding');
		render({ backdropClassName: 'dialog-backdrop operation-panel-backdrop', keepMounted: true });
		expect(backdrop()?.className).toBe('dialog-backdrop operation-panel-backdrop');
	});
});
