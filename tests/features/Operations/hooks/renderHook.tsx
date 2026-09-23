import React from 'react';
import { createRoot } from 'react-dom/client';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Minimal hook harness for this repository (there is no @testing-library). It renders one probe component, keeps the
 * latest hook result, and exposes rerender, unmount, and a flush that drains timers and promise chains.
 */
export function renderHook<P, R>(
	useHook: (props: P) => R,
	initialProps: P,
	wrap: (children: React.ReactNode) => React.ReactNode = (children) => children
) {
	const host = document.createElement('div');
	document.body.append(host);
	const root = createRoot(host);
	const result: { current: R } = { current: undefined as R };
	let renders = 0;

	function Probe(props: { hookProps: P }) {
		renders += 1;
		result.current = useHook(props.hookProps);
		return null;
	}

	function render(props: P) {
		React.act(() => {
			root.render(wrap(<Probe hookProps={props} />));
		});
	}

	render(initialProps);

	return {
		result,
		get renders() {
			return renders;
		},
		rerender: render,
		unmount() {
			React.act(() => root.unmount());
			host.remove();
		},
		async flush(times = 12) {
			for (let index = 0; index < times; index += 1) {
				await React.act(async () => {
					await new Promise((resolve) => setTimeout(resolve, 0));
				});
			}
		},
		act(run: () => void) {
			React.act(run);
		},
	};
}
