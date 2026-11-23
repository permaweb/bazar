export type SequencePhaseBounds = {
	start: number;
	end: number;
};

export function sequencePhaseBounds(index: number, count: number): SequencePhaseBounds {
	if (!Number.isSafeInteger(count) || count < 1) throw new TypeError('invalid-sequence-phase-count');
	if (!Number.isSafeInteger(index) || index < 0 || index >= count) {
		throw new TypeError('invalid-sequence-phase-index');
	}
	return {
		start: (index / count) * 100,
		end: ((index + 1) / count) * 100,
	};
}

/** Localized templates for confirmation progress; each may use {label}, {depth} and {target}. */
export type ConfirmationProgressCopy = {
	progress: string;
	complete: string;
	/** Used only when `uncapped` and the depth has passed a positive target (terminal steps). */
	beyondTarget: string;
};

export function confirmationProgressText(
	label: string,
	confirmations: number,
	target: number,
	copy: ConfirmationProgressCopy,
	uncapped = false
): string {
	const bounded = Math.max(0, target);
	const beyond = uncapped && bounded > 0 && confirmations > bounded;
	const depth = beyond ? confirmations : Math.min(Math.max(0, confirmations), bounded);
	const template = beyond ? copy.beyondTarget : depth >= bounded ? copy.complete : copy.progress;
	return template.replace('{label}', label).replace('{depth}', String(depth)).replace('{target}', String(target));
}

export type ConfirmationProgressValue = {
	min: number;
	max: number;
	/** Omitted while observer verification is delayed: the count is unknown, so the bar is indeterminate. */
	now?: number;
	text: string;
};

/**
 * ARIA progressbar values for the active step. Branch order matches the visible depth label:
 * beyond target, then pending settlement, then delayed observers, then bounded depth.
 */
export function confirmationProgressValue(input: {
	label: string;
	confirmations: number;
	target: number;
	terminal: boolean;
	pendingLabel?: string;
	delayedLabel: string;
	verificationDelayed: boolean;
	copy: ConfirmationProgressCopy;
}): ConfirmationProgressValue {
	const target = Math.max(0, input.target);
	const beyond = input.terminal && target > 0 && input.confirmations > target;
	const depth = beyond ? input.confirmations : Math.min(Math.max(0, input.confirmations), target);
	const max = Math.max(target, depth);
	if (beyond) {
		return {
			min: 0,
			max,
			now: depth,
			text: confirmationProgressText(input.label, depth, target, input.copy, true),
		};
	}
	if (input.pendingLabel && !input.terminal) return { min: 0, max, now: depth, text: input.pendingLabel };
	if (input.verificationDelayed) return { min: 0, max, text: input.delayedLabel };
	return { min: 0, max, now: depth, text: confirmationProgressText(input.label, depth, target, input.copy) };
}

export function confirmationProgressWidth(confirmed: number, active: boolean, hasError: boolean): number {
	return Math.min(active ? 99 : 100, Math.max(active && !hasError ? 2 : 0, confirmed));
}

export function postConfirmationPendingLabel(
	confirmations: number,
	target: number,
	status: string | undefined,
	label = 'Settling live state'
): string | undefined {
	const depth = Math.min(Math.max(0, confirmations), Math.max(0, target));
	return status && target > 0 && depth >= target ? label : undefined;
}

export function confirmationLifecycleState(
	confirmations: number,
	target: number,
	pendingAfterConfirmation: string | undefined,
	hasError: boolean
) {
	const depth = Math.min(Math.max(0, confirmations), Math.max(0, target));
	const pending = Boolean(pendingAfterConfirmation && depth >= target && !hasError);
	return {
		depth,
		pending,
		active: !hasError && (depth < target || pending),
		complete: !hasError && depth >= target && !pending,
	};
}
