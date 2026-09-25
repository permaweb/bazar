// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TRANSACTION_DIALOG_HIDE_DURATION_MS } from 'components/molecules/TransactionDialogControl';
import { useTransactionDialogHide } from 'features/Operations/hooks/useTransactionDialogHide';

import { renderHook } from '../../../test-utils/render-hook';

const onHide = vi.fn();

function hideHook(visible = true) {
	return renderHook((props: { visible: boolean }) => useTransactionDialogHide(props.visible, onHide), { visible });
}

beforeEach(() => {
	vi.useFakeTimers();
	onHide.mockClear();
});

afterEach(() => {
	vi.useRealTimers();
	document.body.innerHTML = '';
});

describe('transaction dialog hiding', () => {
	it('animates the panel toward the activity control before hiding it', () => {
		const trigger = document.createElement('button');
		trigger.className = 'operation-activity-trigger';
		trigger.dataset.activityOwner = 'global';
		document.body.append(trigger);
		const hook = hideHook();
		const panel = document.createElement('div');
		hook.current().panelRef.current = panel;

		hook.act(() => hook.current().hide());
		expect(hook.current().hiding).toBe(true);
		expect(panel.style.getPropertyValue('--dialog-hide-scale')).not.toBe('');
		expect(onHide).not.toHaveBeenCalled();

		hook.act(() => vi.advanceTimersByTime(TRANSACTION_DIALOG_HIDE_DURATION_MS));
		expect(onHide).toHaveBeenCalledTimes(1);
		hook.unmount();
	});

	it('ignores a second hide while one is running', () => {
		const hook = hideHook();
		hook.act(() => hook.current().hide());
		hook.act(() => hook.current().hide());
		hook.act(() => vi.advanceTimersByTime(TRANSACTION_DIALOG_HIDE_DURATION_MS * 2));

		expect(onHide).toHaveBeenCalledTimes(1);
		hook.unmount();
	});

	it('clears the hiding state when the panel is shown again', () => {
		const hook = hideHook(true);
		hook.act(() => hook.current().hide());
		hook.rerender({ visible: false });
		expect(hook.current().hiding).toBe(true);

		hook.rerender({ visible: true });
		expect(hook.current().hiding).toBe(false);
		hook.unmount();
	});

	it('does not hide a panel that was closed before the animation finished', () => {
		const hook = hideHook();
		hook.act(() => hook.current().hide());
		hook.unmount();
		vi.advanceTimersByTime(TRANSACTION_DIALOG_HIDE_DURATION_MS * 2);

		expect(onHide).not.toHaveBeenCalled();
	});
});
