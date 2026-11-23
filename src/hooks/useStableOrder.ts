import React from 'react';

import { nextStableOrder, type StableOrder } from 'helpers/stable-order';

/**
 * The ids of `rankedIds` in a display order that holds still while data streams in (see nextStableOrder).
 * The returned array keeps its identity until the order changes.
 */
export function useStableOrder(rankedIds: readonly string[], key: string, settled: boolean): readonly string[] {
	const [stored, setStored] = React.useState<StableOrder>();
	const order = nextStableOrder(stored, rankedIds, key, settled);
	// Derived from the previous order, so it is stored with a render-phase update (React discards it along
	// with an abandoned render) rather than a ref mutation. nextStableOrder returns its input when nothing
	// changed, so this settles after one extra render.
	if (order !== stored) setStored(order);
	return order.ids;
}

/**
 * Glide the direct children carrying `data-order-id` from their previous slots when the order changes,
 * instead of jumping. This is visual only: Chromium still scores the moves as layout shift unless they
 * follow user input, so callers hold the order (useStableOrder) rather than rely on the glide.
 */
export function useGridReorderMotion(grid: React.RefObject<HTMLElement | null>, order: readonly string[]) {
	const slots = React.useRef(new Map<string, { left: number; top: number }>());
	const host = React.useRef<HTMLElement | null>(null);
	React.useLayoutEffect(() => {
		const container = grid.current;
		if (!container) return;
		// Slots recorded in an earlier grid (another tab visit) do not describe this one.
		if (host.current !== container) slots.current = new Map();
		host.current = container;
		const origin = container.getBoundingClientRect();
		const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
		const next = new Map<string, { left: number; top: number }>();
		for (const card of container.querySelectorAll<HTMLElement>(':scope > [data-order-id]')) {
			const rect = card.getBoundingClientRect();
			const slot = { left: rect.left - origin.left, top: rect.top - origin.top };
			const id = card.dataset.orderId ?? '';
			next.set(id, slot);
			const previous = slots.current.get(id);
			if (!previous || reduceMotion || typeof card.animate !== 'function') continue;
			const dx = previous.left - slot.left;
			const dy = previous.top - slot.top;
			if (Math.abs(dx) < 1 && Math.abs(dy) < 1) continue;
			card.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
				duration: 260,
				easing: 'cubic-bezier(0.2, 0, 0, 1)',
			});
		}
		slots.current = next;
	}, [grid, order]);
}
