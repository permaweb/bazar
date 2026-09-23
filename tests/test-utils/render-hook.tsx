import React from 'react';
import { createRoot } from 'react-dom/client';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

export type HookHarness<Props, Value> = {
	/** The value the hook returned in the latest committed render. */
	current(): Value;
	renders(): number;
	rerender(props: Props): void;
	unmount(): void;
};

/** Render one hook in a jsdom root so effects, cleanup, and re-renders behave as they do in the app. */
export function renderHook<Props, Value>(useHook: (props: Props) => Value, props: Props): HookHarness<Props, Value> {
	const container = document.createElement('div');
	document.body.append(container);
	const root = createRoot(container);
	const values: Value[] = [];

	function HookProbe(probe: { value: Props }) {
		values.push(useHook(probe.value));
		return null;
	}

	const render = (next: Props) => {
		React.act(() => {
			root.render(<HookProbe value={next} />);
		});
	};
	render(props);
	return {
		current: () => values[values.length - 1],
		renders: () => values.length,
		rerender: render,
		unmount: () => {
			React.act(() => root.unmount());
			container.remove();
		},
	};
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

/** Let pending microtasks and effects settle inside one act scope. */
export async function settle(work: () => void | Promise<void> = () => undefined) {
	await React.act(async () => {
		await work();
	});
}
