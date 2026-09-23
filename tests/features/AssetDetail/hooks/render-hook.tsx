import React from 'react';
import { createRoot, type Root } from 'react-dom/client';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

export type HookHarness<Input, Result> = {
	/** The value the hook returned on its most recent render. */
	current(): Result;
	renders(): number;
	rerender(input: Input): void;
	unmount(): void;
};

/**
 * Render one hook in isolation. The repository has no testing-library, so tests drive hooks through a probe
 * component and `React.act`, the same way the Dialog tests drive components.
 */
export function renderHook<Input, Result>(
	hook: (input: Input) => Result,
	initial: Input,
	wrap: (children: React.ReactNode) => React.ReactElement = (children) => <>{children}</>
): HookHarness<Input, Result> {
	const host = document.createElement('div');
	document.body.append(host);
	const root: Root = createRoot(host);
	let latest: { value: Result } | null = null;
	let renders = 0;

	function Probe(props: { input: Input }) {
		renders += 1;
		latest = { value: hook(props.input) };
		return null;
	}

	const render = (input: Input) => React.act(() => root.render(wrap(<Probe input={input} />)));
	render(initial);
	return {
		current() {
			if (!latest) throw new Error('hook-not-rendered');
			return latest.value;
		},
		renders: () => renders,
		rerender: render,
		unmount() {
			React.act(() => root.unmount());
			host.remove();
		},
	};
}

/** Let pending promises settle inside `act` so state updates are applied before assertions. */
export async function settle(times = 1): Promise<void> {
	for (let attempt = 0; attempt < times; attempt += 1) {
		await React.act(async () => {
			await Promise.resolve();
		});
	}
}
