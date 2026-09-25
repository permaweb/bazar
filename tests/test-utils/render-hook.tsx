import React from 'react';
import { createRoot } from 'react-dom/client';

// The repository has no @testing-library, so hook tests render a probe component through `React.act`.
// Requires the jsdom environment (`// @vitest-environment jsdom`).
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

export type HookHarness<Input, Result> = {
	/** The value the hook returned in the latest committed render. */
	current(): Result;
	renders(): number;
	rerender(input: Input): void;
	unmount(): void;
	/** Run a synchronous interaction, such as calling an action the hook returned. */
	act(run: () => void): void;
	/** Drain queued promise callbacks and timers so their state updates apply. */
	flush(times?: number): Promise<void>;
};

/** Render one hook in a jsdom root so effects, cleanup, and re-renders behave as they do in the app. */
export function renderHook<Input, Result>(
	hook: (input: Input) => Result,
	initial: Input,
	wrap: (children: React.ReactNode) => React.ReactNode = (children) => children
): HookHarness<Input, Result> {
	const host = document.createElement('div');
	document.body.append(host);
	const root = createRoot(host);
	let latest: { value: Result } | null = null;
	let renders = 0;

	function Probe(props: { input: Input }) {
		renders += 1;
		latest = { value: hook(props.input) };
		return null;
	}

	const render = (input: Input) => {
		React.act(() => {
			root.render(wrap(<Probe input={input} />));
		});
	};
	render(initial);

	return {
		current() {
			if (!latest) throw new Error('The hook has not rendered.');
			return latest.value;
		},
		renders: () => renders,
		rerender: render,
		unmount() {
			React.act(() => root.unmount());
			host.remove();
		},
		act(run: () => void) {
			React.act(run);
		},
		flush: flushPromises,
	};
}

/** Let pending promise callbacks and timers settle inside `act` so their state updates apply. */
export async function flushPromises(times = 1): Promise<void> {
	for (let attempt = 0; attempt < times; attempt += 1) {
		await React.act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 0));
		});
	}
}

/** Settle pending work inside one act scope: a number repeats microtask flushes, a callback runs inside it. */
export async function settle(work: (() => void | Promise<void>) | number = 1): Promise<void> {
	if (typeof work === 'number') {
		for (let attempt = 0; attempt < work; attempt += 1) {
			await React.act(async () => {
				await Promise.resolve();
			});
		}
		return;
	}
	await React.act(async () => {
		await work();
	});
}

/** A promise a test settles by hand, for one in-flight request. */
export function deferred<Value>() {
	let resolve!: (value: Value) => void;
	let reject!: (cause: unknown) => void;
	const promise = new Promise<Value>((resolvePromise, rejectPromise) => {
		resolve = resolvePromise;
		reject = rejectPromise;
	});
	return { promise, resolve, reject };
}
