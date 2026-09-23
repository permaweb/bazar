import React from 'react';
import { createRoot, type Root } from 'react-dom/client';

// Minimal hook harness for tests without @testing-library. Requires the jsdom environment
// (`// @vitest-environment jsdom`).
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

export type RenderedHook<Props, Result> = {
	/** The value the hook returned on its latest render. */
	current(): Result;
	rerender(props: Props): void;
	unmount(): void;
};

export function renderHook<Props, Result>(
	hook: (props: Props) => Result,
	initialProps: Props
): RenderedHook<Props, Result> {
	const container = document.createElement('div');
	document.body.append(container);
	const root: Root = createRoot(container);
	let latest: { value: Result } | null = null;

	function Harness(props: { hookProps: Props }) {
		latest = { value: hook(props.hookProps) };
		return null;
	}

	React.act(() => root.render(<Harness hookProps={initialProps} />));
	return {
		current() {
			if (!latest) throw new Error('The hook has not rendered.');
			return latest.value;
		},
		rerender(props) {
			React.act(() => root.render(<Harness hookProps={props} />));
		},
		unmount() {
			React.act(() => root.unmount());
			container.remove();
		},
	};
}

/** Let pending promise callbacks settle inside `act` so their state updates apply. */
export async function flushPromises(): Promise<void> {
	await React.act(async () => {
		await new Promise<void>((resolve) => setTimeout(resolve, 0));
	});
}
