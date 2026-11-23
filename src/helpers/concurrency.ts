export async function mapConcurrent<Value, Result>(
	values: readonly Value[],
	concurrency: number,
	map: (value: Value, index: number) => Promise<Result>
): Promise<Result[]> {
	const results = new Array<Result>(values.length);
	const workerCount = Math.min(values.length, Math.max(1, Math.floor(concurrency)));
	let cursor = 0;

	await Promise.all(
		Array.from({ length: workerCount }, async () => {
			while (cursor < values.length) {
				const index = cursor;
				cursor += 1;
				results[index] = await map(values[index], index);
			}
		})
	);

	return results;
}

/**
 * A shared budget for work discovered while earlier work is still running,
 * such as recursive link traversal, where `mapConcurrent` cannot see the whole
 * list up front. Each task holds a slot only while its own promise is pending.
 */
export function createConcurrencyLimit(concurrency: number) {
	const limit = Math.max(1, Math.floor(concurrency));
	const waiting: Array<() => void> = [];
	let active = 0;
	const release = () => {
		active -= 1;
		waiting.shift()?.();
	};
	return <Result>(task: () => Promise<Result>): Promise<Result> =>
		new Promise<Result>((resolve, reject) => {
			const start = () => {
				active += 1;
				Promise.resolve().then(task).then(resolve, reject).finally(release);
			};
			if (active < limit) start();
			else waiting.push(start);
		});
}
