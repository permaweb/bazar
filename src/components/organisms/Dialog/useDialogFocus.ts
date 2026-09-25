import React from 'react';

const FOCUSABLE = [
	'a[href]',
	'button:not([disabled])',
	'input:not([disabled])',
	'select:not([disabled])',
	'textarea:not([disabled])',
	'[tabindex]:not([tabindex="-1"])',
].join(',');

type ScrollLock = {
	scrollX: number;
	scrollY: number;
	body: Pick<CSSStyleDeclaration, 'overflow' | 'paddingRight' | 'position' | 'top' | 'left' | 'width'>;
	htmlOverflow: string;
};

let scrollLockCount = 0;
let scrollLock: ScrollLock | null = null;
const inertedBackgrounds = new WeakMap<HTMLElement, { count: number; previous: boolean }>();

function lockDocumentScroll() {
	if (scrollLockCount++ > 0) return releaseDocumentScroll;
	const body = document.body;
	const html = document.documentElement;
	const scrollbar = Math.max(0, window.innerWidth - html.clientWidth);
	const bodyPadding = Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0;
	scrollLock = {
		scrollX: window.scrollX,
		scrollY: window.scrollY,
		body: {
			overflow: body.style.overflow,
			paddingRight: body.style.paddingRight,
			position: body.style.position,
			top: body.style.top,
			left: body.style.left,
			width: body.style.width,
		},
		htmlOverflow: html.style.overflow,
	};
	body.style.overflow = 'hidden';
	body.style.position = 'fixed';
	body.style.top = `-${scrollLock.scrollY}px`;
	body.style.left = `-${scrollLock.scrollX}px`;
	body.style.width = '100%';
	if (scrollbar > 0) body.style.paddingRight = `${bodyPadding + scrollbar}px`;
	html.style.overflow = 'hidden';
	return releaseDocumentScroll;
}

function releaseDocumentScroll() {
	if (scrollLockCount === 0 || --scrollLockCount > 0) return;
	if (!scrollLock) return;
	const held = scrollLock;
	scrollLock = null;
	Object.assign(document.body.style, held.body);
	document.documentElement.style.overflow = held.htmlOverflow;
	const scrollBehavior = document.documentElement.style.scrollBehavior;
	document.documentElement.style.scrollBehavior = 'auto';
	window.scrollTo(held.scrollX, held.scrollY);
	document.documentElement.style.scrollBehavior = scrollBehavior;
}

function acquireBackground(element: HTMLElement) {
	const held = inertedBackgrounds.get(element);
	if (held) {
		held.count += 1;
		return;
	}
	inertedBackgrounds.set(element, { count: 1, previous: element.inert });
	element.inert = true;
}

function releaseBackground(element: HTMLElement) {
	const held = inertedBackgrounds.get(element);
	if (!held) return;
	if (--held.count > 0) return;
	element.inert = held.previous;
	inertedBackgrounds.delete(element);
}

function isolateDialogBackground(container: HTMLElement) {
	const backgrounds: HTMLElement[] = [];
	let branch: HTMLElement | null = container;
	while (branch?.parentElement) {
		const parent: HTMLElement = branch.parentElement;
		for (const sibling of parent.children) {
			if (!(sibling instanceof HTMLElement) || sibling === branch) continue;
			if (sibling.matches('script, style, link')) continue;
			backgrounds.push(sibling);
			acquireBackground(sibling);
		}
		if (parent === document.body) break;
		branch = parent;
	}
	return () => {
		for (const element of backgrounds.reverse()) releaseBackground(element);
	};
}

export function targetOwnsDialogEscape(target: EventTarget | null) {
	const closest = (target as { closest?: unknown } | null)?.closest;
	return typeof closest === 'function' && Boolean(closest.call(target, '[data-dialog-escape-owner]'));
}

// Where focus returns when a dialog closes: an element, a lookup evaluated at close time, or `false` to skip.
export type DialogFocusTarget = HTMLElement | null | false | (() => HTMLElement | null);

function resolveRestoreTarget(target?: DialogFocusTarget) {
	return typeof target === 'function' ? target() : target || null;
}

export function isDialogRestoreTarget(target: HTMLElement | null) {
	if (!target?.isConnected || target.hidden) return false;
	if ('disabled' in target && Boolean(target.disabled)) return false;
	if (target.getAttribute('aria-disabled') === 'true') return false;
	for (let current: HTMLElement | null = target; current; current = current.parentElement) {
		if (current.inert) return false;
	}
	return target.getClientRects().length > 0;
}

export function dialogRestoreTarget(preferred: HTMLElement | null, fallback: HTMLElement | null) {
	if (isDialogRestoreTarget(preferred)) return preferred;
	return isDialogRestoreTarget(fallback) ? fallback : null;
}

export function isDialogFocusable(element: HTMLElement) {
	return element.tabIndex >= 0 && element.getClientRects().length > 0;
}

// Modal focus behavior for the Dialog organism: scroll lock, background isolation, initial focus, Tab
// containment, Escape, and focus restoration. Callbacks and restore targets are read at use time, so only
// `active` and `focusKey` re-run initial focus.
export function useDialogFocus(
	containerRef: React.RefObject<HTMLElement>,
	options: {
		active: boolean;
		focusKey?: unknown;
		onEscape(): void;
		restoreFallback?: DialogFocusTarget;
		restoreTarget?: DialogFocusTarget;
	}
) {
	const latestOptions = React.useRef(options);
	const restoreFrameRef = React.useRef<number | null>(null);
	const mountedRestoreTarget = React.useRef(
		typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null
	);
	latestOptions.current = options;

	React.useLayoutEffect(() => {
		if (!options.active) return;
		return lockDocumentScroll();
	}, [options.active]);

	React.useLayoutEffect(() => {
		if (!options.active) return;
		const container = containerRef.current;
		if (!container) return;
		return isolateDialogBackground(container);
	}, [options.active]);

	React.useLayoutEffect(() => {
		if (!options.active) return;
		if (restoreFrameRef.current !== null) {
			window.cancelAnimationFrame(restoreFrameRef.current);
			restoreFrameRef.current = null;
		}
		const container = containerRef.current;
		if (!container) return;
		const focusable = () => [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(isDialogFocusable);
		const initial = [...container.querySelectorAll<HTMLElement>('[data-dialog-initial], [autofocus]')].find(
			(element) => element.matches(FOCUSABLE) && isDialogFocusable(element)
		);
		(initial ?? focusable()[0] ?? container).focus();
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape' && targetOwnsDialogEscape(event.target)) return;
			if (event.key === 'Escape') {
				event.preventDefault();
				latestOptions.current.onEscape();
				return;
			}
			if (event.key !== 'Tab') return;
			const elements = focusable();
			if (!elements.length) {
				event.preventDefault();
				container.focus();
				return;
			}
			const first = elements[0];
			const last = elements[elements.length - 1];
			if (!container.contains(document.activeElement)) {
				event.preventDefault();
				(event.shiftKey ? last : first).focus();
			} else if (event.shiftKey && document.activeElement === first) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && document.activeElement === last) {
				event.preventDefault();
				first.focus();
			}
		};
		document.addEventListener('keydown', handleKeyDown, true);
		return () => {
			document.removeEventListener('keydown', handleKeyDown, true);
			if (latestOptions.current.restoreTarget === false) return;
			restoreFrameRef.current = window.requestAnimationFrame(() => {
				restoreFrameRef.current = null;
				const returnFocusTo = dialogRestoreTarget(
					resolveRestoreTarget(latestOptions.current.restoreTarget) ?? mountedRestoreTarget.current,
					resolveRestoreTarget(latestOptions.current.restoreFallback)
				);
				returnFocusTo?.focus();
			});
		};
	}, [options.active, options.focusKey]);
}
