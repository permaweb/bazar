// @vitest-environment jsdom
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CollectionActivityEvent } from 'api/discovery';

import { useMarketActivityNow } from 'features/Activity/hooks/useMarketActivityNow';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const START = Date.UTC(2026, 7, 7, 16, 35, 12, 500);

let host: HTMLElement;
let root: Root;
let now: number | undefined;

function Clock(props: { events: CollectionActivityEvent[] }) {
	now = useMarketActivityNow(props.events);
	return null;
}

function event(elapsedMs: number): CollectionActivityEvent {
	return {
		action: 'transfer',
		actor: 'actor',
		height: 1,
		id: `event-${elapsedMs}`,
		processId: 'process',
		timestamp: (START - elapsedMs) / 1_000,
	};
}

function setVisibility(state: DocumentVisibilityState) {
	Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
	React.act(() => {
		document.dispatchEvent(new Event('visibilitychange'));
	});
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(START);
	setVisibility('visible');
	host = document.createElement('div');
	document.body.append(host);
	root = createRoot(host);
	now = undefined;
});

afterEach(() => {
	React.act(() => root.unmount());
	host.remove();
	vi.useRealTimers();
});

describe('useMarketActivityNow', () => {
	it('ticks at the next boundary where a relative label changes', () => {
		React.act(() => root.render(<Clock events={[event(2_500)]} />));
		expect(now).toBe(START);

		React.act(() => {
			vi.advanceTimersByTime(519);
		});
		expect(now).toBe(START);

		React.act(() => {
			vi.advanceTimersByTime(1);
		});
		expect(now).toBe(START + 520);
	});

	it('does not schedule ticks without dated events', () => {
		React.act(() => root.render(<Clock events={[]} />));
		expect(vi.getTimerCount()).toBe(0);
	});

	it('pauses while hidden and resumes with a fresh clock when visible again', () => {
		React.act(() => root.render(<Clock events={[event(2_500)]} />));
		setVisibility('hidden');
		expect(vi.getTimerCount()).toBe(0);

		vi.setSystemTime(START + 60_000);
		setVisibility('visible');
		expect(now).toBe(START + 60_000);
		expect(vi.getTimerCount()).toBe(1);
	});

	it('removes its timer and visibility listener on unmount', () => {
		const removeListener = vi.spyOn(document, 'removeEventListener');
		React.act(() => root.render(<Clock events={[event(2_500)]} />));
		React.act(() => root.unmount());

		expect(vi.getTimerCount()).toBe(0);
		expect(removeListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
		root = createRoot(host);
		removeListener.mockRestore();
	});
});
