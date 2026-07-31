import type { ObserverView } from 'weave-wrangler';

export type ConfirmationTrustTone =
	| 'error'
	| 'neutral'
	| 'pending'
	| 'confirmation-1'
	| 'confirmation-2'
	| 'confirmation-3'
	| 'confirmation-4'
	| 'confirmation-5';

export function confirmationTrustTone(
	state: ObserverView['state'],
	confirmations: number,
	hasError: boolean
): ConfirmationTrustTone {
	if (hasError || state === 'gone') return 'error';
	if (state === 'unknown' || state === 'not-found') return 'neutral';
	if (state === 'pending') return 'pending';

	if (confirmations >= 5) return 'confirmation-5';
	if (confirmations === 4) return 'confirmation-4';
	if (confirmations === 3) return 'confirmation-3';
	if (confirmations === 2) return 'confirmation-2';
	if (confirmations === 1) return 'confirmation-1';
	return 'neutral';
}
