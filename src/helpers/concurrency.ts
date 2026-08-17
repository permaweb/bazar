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
