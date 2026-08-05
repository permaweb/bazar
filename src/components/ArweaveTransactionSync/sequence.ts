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

export function confirmationProgressText(label: string, confirmations: number, target: number): string {
  const depth = Math.min(Math.max(0, confirmations), Math.max(0, target));
  return `${label}: ${depth} of ${target} confirmations${depth >= target ? ' complete' : ''}.`;
}

export function confirmationProgressWidth(confirmed: number, active: boolean, hasError: boolean): number {
  return Math.min(active ? 99 : 100, Math.max(active && !hasError ? 2 : 0, confirmed));
}

export function confirmationLifecycleState(
  confirmations: number,
  target: number,
  pendingAfterConfirmation: string | undefined,
  hasError: boolean,
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
