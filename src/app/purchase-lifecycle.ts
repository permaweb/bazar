import type { PurchaseSnapshot, PurchaseState } from 'weave-wrangler';

export type PurchaseLifecycleMilestone = 'signed' | 'submitted' | 'accepted' | 'mined' | 'applied' | 'complete';
export const PURCHASE_SKIP_FROM_DEPTH = 3;

const REGISTRATION_APPLIED_STAGES = new Set<PurchaseState['stage']>([
	'signing-payment',
	'dispatching-payment',
	'payment-propagating',
	'payment-confirming',
	'ownership-verifying',
	'complete',
]);

export function purchaseLifecycleMilestone(state: PurchaseState | null): PurchaseLifecycleMilestone | null {
	if (!state) return null;
	if (state.stage === 'complete') return 'complete';
	if (state.stage === 'ownership-verifying') return 'mined';
	if (REGISTRATION_APPLIED_STAGES.has(state.stage)) {
		const payment = state.payment;
		if (!payment?.id) return 'applied';
		if (!payment.dispatched) return state.stage === 'dispatching-payment' ? 'submitted' : 'signed';
		if ((payment.consensus?.confirmations ?? 0) > 0) return 'mined';
		return 'accepted';
	}
	if (state.stage === 'registration-accepting') return 'mined';
	const registration = state.registration;
	if (!registration?.id) return null;
	if (!registration.dispatched) return state.stage === 'dispatching-registration' ? 'submitted' : 'signed';
	if ((registration.consensus?.confirmations ?? 0) > 0) return 'mined';
	return 'accepted';
}

export function purchaseSkipKind(state: PurchaseState | null): 'yolo' | 'skip' | undefined {
	if (!state?.canSkip) return undefined;
	return (state.registration?.consensus?.confirmations ?? 0) <= PURCHASE_SKIP_FROM_DEPTH ? 'yolo' : 'skip';
}

export function purchaseLifecycleStatus(state: PurchaseState | null) {
	if (!state) return '';
	if (state.stage === 'complete') {
		return 'Applied to live process state. Purchase complete.';
	}
	if (state.stage === 'ownership-verifying') {
		return 'Payment mined. Waiting for it to be applied to live process state.';
	}
	if (state.stage === 'payment-confirming') {
		return (state.payment?.consensus.confirmations ?? 0) > 0
			? 'Payment mined. Waiting for the required confirmation depth.'
			: 'Payment dispatched. Waiting for it to be mined.';
	}
	if (state.stage === 'payment-propagating') {
		return 'Payment accepted by Arweave. Waiting for it to be mined.';
	}
	if (state.stage === 'dispatching-payment') {
		return 'Signed seller payment submitted. Waiting for Arweave acceptance; observation delay will not create a replacement.';
	}
	if (state.stage === 'signing-payment') {
		return 'Reservation applied to live process state. Preparing the seller payment.';
	}
	if (state.stage === 'registration-accepting') {
		const confirmations = state.registration?.consensus.confirmations ?? 0;
		return `Reservation mined. ${confirmations} registration confirmation${
			confirmations === 1 ? '' : 's'
		} reported. Waiting for it to be applied to live process state before payment is released.`;
	}
	if (state.stage === 'registration-confirming') {
		return (state.registration?.consensus.confirmations ?? 0) > 0
			? 'Reservation mined. Waiting for the required confirmation depth.'
			: 'Reservation dispatched. Waiting for it to be mined.';
	}
	if (state.stage === 'registration-propagating') {
		return 'Reservation accepted by Arweave. Waiting for it to be mined.';
	}
	if (state.stage === 'dispatching-registration') {
		return 'Signed reservation submitted. Waiting for Arweave acceptance; observation delay will not create a replacement.';
	}
	if (state.stage === 'signing') return 'Waiting for the reservation and seller payment signatures.';
	if (state.stage === 'failed') return state.error?.message ?? 'Purchase observation needs attention.';
	return '';
}

export type PurchaseGatewayContext = {
	arweave: string;
	compute: string;
};

export function purchaseGatewaySwitchNotice(
	original: PurchaseGatewayContext | undefined,
	current: PurchaseGatewayContext,
	snapshot?: PurchaseSnapshot | null
) {
	if (!original || (original.arweave === current.arweave && original.compute === current.compute)) return '';
	const ids = [snapshot?.registration?.id, snapshot?.payment?.id].filter(
		(id): id is string => typeof id === 'string' && /^[A-Za-z0-9_-]{43}$/.test(id)
	);
	if (!ids.length) return '';
	return `Gateway selection changed during this purchase. Bazar will resume only the ${
		ids.length === 1 ? 'saved transaction ID' : `${ids.length} saved transaction IDs`
	}; it will not sign or submit replacements.`;
}
