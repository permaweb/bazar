import { describe, expect, it, vi } from 'vitest';

import { handleActivityPopoverKey } from './App';

function setup() {
	const close = vi.fn();
	const focus = vi.fn();
	const scheduled: Array<() => void> = [];
	const schedule = vi.fn((callback: () => void) => scheduled.push(callback));
	return { close, focus, trigger: { current: { focus } }, schedule, flush: () => scheduled.forEach((run) => run()) };
}

describe('Transaction activity popover keyboard dismissal', () => {
	it('closes on Escape and returns focus to the trigger after the close renders', () => {
		const { close, focus, trigger, schedule, flush } = setup();
		expect(handleActivityPopoverKey({ key: 'Escape', defaultPrevented: false }, close, trigger, schedule)).toBe(
			true
		);
		expect(close).toHaveBeenCalledTimes(1);
		expect(focus).not.toHaveBeenCalled();
		flush();
		expect(focus).toHaveBeenCalledTimes(1);
	});

	it.each(['Enter', ' ', 'Tab', 'ArrowDown', 'Esc'])('ignores %j', (key) => {
		const { close, focus, trigger, schedule, flush } = setup();
		expect(handleActivityPopoverKey({ key, defaultPrevented: false }, close, trigger, schedule)).toBe(false);
		flush();
		expect(close).not.toHaveBeenCalled();
		expect(schedule).not.toHaveBeenCalled();
		expect(focus).not.toHaveBeenCalled();
	});

	it('leaves Escape to a dialog that already handled it', () => {
		const { close, trigger, schedule } = setup();
		expect(handleActivityPopoverKey({ key: 'Escape', defaultPrevented: true }, close, trigger, schedule)).toBe(
			false
		);
		expect(close).not.toHaveBeenCalled();
		expect(schedule).not.toHaveBeenCalled();
	});

	it('still closes when the trigger has unmounted', () => {
		const close = vi.fn();
		const schedule = (callback: () => void) => callback();
		expect(
			handleActivityPopoverKey({ key: 'Escape', defaultPrevented: false }, close, { current: null }, schedule)
		).toBe(true);
		expect(close).toHaveBeenCalledTimes(1);
	});
});
