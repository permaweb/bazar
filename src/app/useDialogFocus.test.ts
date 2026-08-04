import { describe, expect, it, vi } from 'vitest';
import {
	dialogRestoreTarget,
	isDialogRestoreTarget,
	isDialogFocusable,
	targetOwnsDialogEscape,
} from './useDialogFocus';

function restoreCandidate({
	connected = true,
	disabled = false,
	hidden = false,
	inert = false,
	ariaDisabled = false,
	visible = true,
} = {}) {
	return {
		isConnected: connected,
		disabled,
		hidden,
		inert,
		parentElement: null,
		getAttribute: (name: string) => name === 'aria-disabled' && ariaDisabled ? 'true' : null,
		getClientRects: () => visible ? [{}] : [],
	} as unknown as HTMLElement;
}

describe('dialog Escape ownership', () => {
	it('leaves Escape to an explicitly owning control', () => {
		const closest = vi.fn(() => ({ dataset: { dialogEscapeOwner: '' } }));
		expect(targetOwnsDialogEscape({ closest } as unknown as EventTarget)).toBe(true);
		expect(closest).toHaveBeenCalledWith('[data-dialog-escape-owner]');
	});

	it('keeps ordinary controls under dialog ownership', () => {
		expect(targetOwnsDialogEscape({ closest: () => null } as unknown as EventTarget)).toBe(false);
		expect(targetOwnsDialogEscape(null)).toBe(false);
	});
});

describe('dialog focus restoration', () => {
	it('returns to the original enabled action when it remains available', () => {
		const original = restoreCandidate();
		const stableHeading = restoreCandidate();
		expect(dialogRestoreTarget(original, stableHeading)).toBe(original);
	});

	it.each([
		['disabled', { disabled: true }],
		['aria-disabled', { ariaDisabled: true }],
		['disconnected', { connected: false }],
		['hidden', { hidden: true }],
		['not rendered', { visible: false }],
		['inert', { inert: true }],
	])('falls back to the stable asset heading when the action is %s', (_label, state) => {
		const original = restoreCandidate(state);
		const stableHeading = restoreCandidate();
		expect(isDialogRestoreTarget(original)).toBe(false);
		expect(dialogRestoreTarget(original, stableHeading)).toBe(stableHeading);
	});
});

describe('dialog focus candidates', () => {
	it('excludes inactive controls from roving tab sets', () => {
		const candidate = (tabIndex: number) => ({
			tabIndex,
			getClientRects: () => [{}],
		}) as unknown as HTMLElement;
		expect(isDialogFocusable(candidate(0))).toBe(true);
		expect(isDialogFocusable(candidate(-1))).toBe(false);
	});
});
