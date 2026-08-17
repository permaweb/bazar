const FRIENDLY_ERRORS: Record<string, string> = {
	'collection-indexes-unavailable':
		'No collection index could be read from Arweave. Check your connection and retry.',
	'asset-purchase-insufficient-funds-after-signing':
		'This wallet does not have enough AR for the transaction and network fee. Add AR, then continue the transaction saved in this browser with the same wallet.',
	'asset-purchase-insufficient-funds':
		'This wallet does not have enough AR for the network reward. No transaction was submitted.',
	'transaction-propagation-timeout':
		'The sampled observers did not reach the required propagation quorum in time. The signed transaction remains saved in this browser; return with the same wallet and retained browser data to continue checking it.',
	'asset-state-timeout':
		'The sampled observers report the transaction as confirmed, but the selected compute gateway has not applied it yet. Continue to keep checking live state.',
	'asset-order-reservation-expired':
		'The reservation window passed before the seller payment was dispatched. No seller payment was sent. The stale recovery has been cleared; start a new purchase if the listing is still available.',
	'asset-order-reservation-rejected':
		'The reservation was not active when the token process reached its transaction. It may have lost a race or been rejected by the token process. No seller payment was sent. The stale recovery has been cleared; review the current listing before trying again.',
	'wallet-account-changed':
		'The connected wallet changed after signing. Reconnect the original signer to continue the transaction saved in this browser.',
	'wallet-recovery-conflict':
		'Another signed action is already pending for this asset. Resume that action before starting a new one.',
	'wallet-operation-lock-unavailable':
		'This browser cannot safely coordinate wallet approvals across tabs. Use a current browser with Web Locks support to trade.',
	'market-state-changed':
		'The owner or listing changed since it was last checked. Close this dialog and review the updated market state before approving anything.',
	'asset-pending-listing-check-unavailable':
		'Bazar could not check Arweave for another recent listing transaction, so it did not ask your wallet to sign. Retry shortly.',
	'registration-not-found':
		'The exact reservation is already signed and submitted, but Bazar could not verify it across the required Arweave observers and live asset state during this check. Bazar will keep checking it automatically without signing again.',
	'registration not found':
		'The exact reservation is already signed and submitted, but Bazar could not verify it across the required Arweave observers and live asset state during this check. Bazar will keep checking it automatically without signing again.',
	'payment-not-found':
		'The exact seller payment was submitted, but Bazar could not verify it across the required Arweave observers and live asset state during this check. Bazar will keep checking it automatically without paying again.',
	'payment not found':
		'The exact seller payment was submitted, but Bazar could not verify it across the required Arweave observers and live asset state during this check. Bazar will keep checking it automatically without paying again.',
	'fungible-transfer-rejected':
		'This transfer reached its exact token schedule slot, but live state proves it was not applied. No tokens moved. Review the current balance before trying again.',
	'fungible-transfer-proof-mismatch':
		'The selected compute gateway returned incomplete scheduler proof for this transfer. The signed transaction is saved in this browser; continue it here, or close this dialog and choose another Compute gateway in the header.',
	'asset-cancel-rejected':
		'This cancellation reached its exact schedule slot, but live state proves it was not applied. The listing changed first. Review the current order book before trying again.',
	'asset-cancel-proof-mismatch':
		'The selected compute gateway returned incomplete scheduler proof for this cancellation. The signed transaction is saved in this browser; continue it here, or close this dialog and choose another Compute gateway in the header.',
	'asset-purchase-rejected':
		'The exact seller payment reached this asset’s schedule, but the token transfer was not applied. The permanent payment evidence remains saved for review.',
	'asset-purchase-proof-mismatch':
		'The selected compute gateway returned incomplete scheduler proof for this purchase. Both transaction IDs remain saved in this browser; continue here, or close this dialog and choose another Compute gateway in the header.',
	'asset-payment-id-missing':
		'This purchase recovery does not contain its exact seller-payment ID, so Bazar cannot prove settlement safely.',
	'asset-action-starting-slot-unavailable':
		'The selected compute gateway did not expose an exact process slot, so Bazar did not ask the wallet to approve this action. Retry, or choose another Compute gateway.',
	'asset-action-recovery-baseline-missing':
		'This older signed action has no exact process-slot baseline, so Bazar cannot reliably infer its outcome from aggregate state. The signed transaction remains saved in this browser for review.',
	'transaction-dispatch-rejected':
		'The submission gateway rejected this exact signed transaction, so Bazar has no evidence that Arweave accepted it. Discard it before asking your wallet to sign a corrected replacement.',
	'registration-dispatch-rejected':
		'The submission gateway rejected the signed reservation. No seller payment was sent. Review the current listing before signing a replacement.',
	'payment-dispatch-rejected':
		'The submission gateway rejected the signed seller payment. The reservation may still be active; continue to recheck it and sign only a replacement payment if needed.',
};

export function marketplaceErrorMessage(error: unknown): string {
	const value = error instanceof Error ? error.message : String(error);
	const code = error && typeof error === 'object' ? String((error as { code?: unknown }).code ?? '') : '';
	return FRIENDLY_ERRORS[code] ?? FRIENDLY_ERRORS[value] ?? value.replaceAll('-', ' ');
}

export type MarketplaceOperationFailure =
	| 'market-state-changed'
	| 'transaction-not-sent'
	| 'transaction-rejected'
	| 'other';

export function marketplaceCodedError(code: string, message = code): Error & { code: string } {
	return Object.assign(new Error(message), { code });
}

export function marketplaceOperationFailure(error: unknown): MarketplaceOperationFailure {
	const value = error instanceof Error ? error.message : String(error);
	const code = error && typeof error === 'object' ? String((error as { code?: unknown }).code ?? '') : '';
	if (value === 'market-state-changed') return 'market-state-changed';
	if (code === 'transaction-dispatch-not-sent') return 'transaction-not-sent';
	return [
		'fungible-transfer-rejected',
		'asset-cancel-rejected',
		'asset-purchase-rejected',
		'asset-order-reservation-rejected',
		'asset-order-reservation-expired',
	].includes(value) ||
		['transaction-dispatch-rejected', 'registration-dispatch-rejected', 'payment-dispatch-rejected'].includes(code)
		? 'transaction-rejected'
		: 'other';
}

export type MarketplaceRequestSource = 'compute' | 'index';
export type MarketplaceFailureKind = 'rate-limited' | 'unavailable';

export function marketplaceFailureKind(error: unknown): MarketplaceFailureKind {
	const value = error instanceof Error ? error.message : String(error);
	return /(?:^|[-\s])429(?:\b|$)/i.test(value) ? 'rate-limited' : 'unavailable';
}

export function marketplaceRequestFailureMessage(
	source: MarketplaceRequestSource,
	kind: MarketplaceFailureKind
): string {
	if (source === 'compute' && kind === 'rate-limited') {
		return 'The selected compute gateway is temporarily rate-limiting live-state requests. Wait briefly and retry, or choose another Compute gateway in the header.';
	}
	if (source === 'index' && kind === 'rate-limited') {
		return 'Arweave’s transaction index is temporarily rate-limiting requests. Wait briefly and retry.';
	}
	if (source === 'compute') {
		return 'Live state could not be read through the selected compute gateway. Retry, or choose another Compute gateway in the header.';
	}
	return 'Arweave’s transaction index could not be read. Retry shortly.';
}

export function isRejectedTransactionDispatch(error: unknown): boolean {
	const value = error instanceof Error ? error.message : String(error);
	const code = error && typeof error === 'object' ? String((error as { code?: unknown }).code ?? '') : '';
	return code === 'transaction-dispatch-rejected' || /^transaction dispatch (?:400|422)(?:\b|$)/i.test(value);
}
