export function scheduleIdleTask(task: () => void, timeout = 1_500) {
	if (typeof window.requestIdleCallback === 'function') {
		const id = window.requestIdleCallback(task, { timeout });
		return () => window.cancelIdleCallback(id);
	}
	const id = window.setTimeout(task, timeout);
	return () => window.clearTimeout(id);
}
