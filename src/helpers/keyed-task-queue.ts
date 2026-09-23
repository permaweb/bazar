/** A shared concurrency budget across incremental batches, with queued-key deduplication. */
export function createKeyedTaskQueue(concurrency: number) {
	type Task = {
		key: string;
		run: () => Promise<void>;
		promise: Promise<void>;
		resolve: () => void;
		reject: (cause: unknown) => void;
		started: boolean;
	};
	const tasks = new Map<string, Task>();
	let pending: Task[] = [];
	let active = 0;
	const limit = Math.max(1, Math.floor(concurrency));
	const pump = () => {
		while (active < limit && pending.length) {
			const task = pending.shift()!;
			if (tasks.get(task.key) !== task) continue;
			task.started = true;
			active += 1;
			void Promise.resolve()
				.then(task.run)
				.then(task.resolve, task.reject)
				.finally(() => {
					if (tasks.get(task.key) === task) tasks.delete(task.key);
					active -= 1;
					pump();
				});
		}
	};
	const cancel = (key: string) => {
		const task = tasks.get(key);
		if (!task) return;
		tasks.delete(key);
		if (!task.started) task.resolve();
	};
	return {
		enqueue(key: string, run: () => Promise<void>): Promise<void> {
			const existing = tasks.get(key);
			if (existing) return existing.promise;
			let resolve!: () => void;
			let reject!: (cause: unknown) => void;
			const promise = new Promise<void>((done, failed) => {
				resolve = done;
				reject = failed;
			});
			const task = { key, run, promise, resolve, reject, started: false };
			tasks.set(key, task);
			pending.push(task);
			pump();
			return promise;
		},
		prioritize(keys: string[]) {
			const ranks = new Map(keys.map((key, index) => [key, index]));
			pending.sort(
				(left, right) =>
					(ranks.get(left.key) ?? Number.POSITIVE_INFINITY) -
					(ranks.get(right.key) ?? Number.POSITIVE_INFINITY)
			);
		},
		cancel,
		clear() {
			for (const key of tasks.keys()) cancel(key);
			pending = [];
		},
	};
}
