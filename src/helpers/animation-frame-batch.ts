export function createAnimationFrameBatch<T>(
	publish: (values: T[]) => void,
	requestFrame: (callback: FrameRequestCallback) => number = (callback) => window.requestAnimationFrame(callback),
	cancelFrame: (handle: number) => void = (handle) => window.cancelAnimationFrame(handle)
) {
	let frame: number | undefined;
	let pending: T[] = [];
	const publishPending = () => {
		if (!pending.length) return;
		const values = pending;
		pending = [];
		publish(values);
	};
	const flush = () => {
		if (frame !== undefined) cancelFrame(frame);
		frame = undefined;
		publishPending();
	};
	return {
		push(value: T) {
			pending.push(value);
			frame ??= requestFrame(() => {
				frame = undefined;
				publishPending();
			});
		},
		flush,
		cancel() {
			if (frame !== undefined) cancelFrame(frame);
			frame = undefined;
			pending = [];
		},
	};
}
