import { describe, expect, it, vi } from 'vitest';

import { createKeyedTaskQueue } from 'helpers/keyed-task-queue';

function deferred() {
	let resolve!: () => void;
	const promise = new Promise<void>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}

describe('incremental asset task queue', () => {
	it('deduplicates waiting assets and shares one concurrency budget across batches', async () => {
		const queue = createKeyedTaskQueue(2);
		const gates = Array.from({ length: 4 }, deferred);
		const started: number[] = [];
		const tasks = gates.map((gate, index) =>
			vi.fn(async () => {
				started.push(index);
				await gate.promise;
			})
		);
		const first = queue.enqueue('0', tasks[0]);
		const second = queue.enqueue('1', tasks[1]);
		const third = queue.enqueue('2', tasks[2]);
		await Promise.resolve();
		expect(started).toEqual([0, 1]);
		expect(queue.enqueue('2', tasks[2])).toBe(third);
		const fourth = queue.enqueue('3', tasks[3]);
		gates[1].resolve();
		await vi.waitFor(() => expect(started).toEqual([0, 1, 2]));
		gates[2].resolve();
		await vi.waitFor(() => expect(started).toEqual([0, 1, 2, 3]));
		gates[3].resolve();
		await Promise.all([second, third, fourth]);
		// One stuck asset never prevents healthy work using the other slot.
		expect(tasks[2]).toHaveBeenCalledOnce();
		gates[0].resolve();
		await first;
	});

	it('promotes visible assets without losing or restarting background work', async () => {
		const queue = createKeyedTaskQueue(1);
		const firstGate = deferred();
		const order: string[] = [];
		const first = queue.enqueue('first', () => firstGate.promise);
		const background = queue.enqueue('background', async () => {
			order.push('background');
		});
		const visible = queue.enqueue('visible', async () => {
			order.push('visible');
		});
		queue.prioritize(['visible']);
		firstGate.resolve();
		await Promise.all([first, background, visible]);
		expect(order).toEqual(['visible', 'background']);
	});

	it('cancels obsolete queued work and releases slots after failures', async () => {
		const queue = createKeyedTaskQueue(1);
		const gate = deferred();
		const first = queue.enqueue('first', () => gate.promise);
		const obsolete = vi.fn(async () => undefined);
		const canceled = queue.enqueue('obsolete', obsolete);
		queue.cancel('obsolete');
		await canceled;
		const failed = queue.enqueue('failed', async () => {
			throw new Error('unavailable');
		});
		const failure = expect(failed).rejects.toThrow('unavailable');
		const last = vi.fn(async () => undefined);
		const done = queue.enqueue('last', last);
		gate.resolve();
		await Promise.all([first, failure, done]);
		expect(obsolete).not.toHaveBeenCalled();
		expect(last).toHaveBeenCalledOnce();
	});
});
