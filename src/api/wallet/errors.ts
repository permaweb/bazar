import { type AppError, appError, type AppErrorReason, isAppError, toAppError } from 'helpers/app-error';

/**
 * Wallet extensions report a declined approval only as free text: Wander rejects with messages such as
 * "User cancelled the AuthRequest", and other injected wallets use "rejected", "denied", or "declined". This is the
 * one place Bazar reads wallet error text; every caller branches on the returned `AppError` instead.
 */
const DECLINED_BY_USER = /\b(?:cancel(?:l)?ed|reject(?:ed)?|denied|declined)\b/i;

function declinedByUser(cause: unknown): boolean {
	const message =
		typeof cause === 'string'
			? cause
			: cause && typeof cause === 'object'
			? (cause as { message?: unknown }).message
			: undefined;
	return typeof message === 'string' && DECLINED_BY_USER.test(message);
}

/**
 * Normalize a failed wallet extension call. A declined approval becomes `declinedReason`; aborts stay `cancelled`;
 * anything else becomes `fallbackReason`.
 */
export function walletFailure(
	cause: unknown,
	fallbackReason: AppErrorReason,
	declinedReason: AppErrorReason = 'wallet-request-rejected'
): AppError {
	if (isAppError(cause)) return cause;
	const normalized = toAppError(cause, fallbackReason);
	if (normalized.code === 'cancelled') return normalized;
	return declinedByUser(cause) ? appError(declinedReason, { cause }) : normalized;
}

/** Ask the wallet to sign, mapping a declined or failed approval into the application taxonomy. */
export async function signWithWallet<Transaction>(
	sign: (transaction: Transaction) => Promise<Transaction | undefined | null>,
	transaction: Transaction
): Promise<Transaction> {
	try {
		return (await sign(transaction)) ?? transaction;
	} catch (cause) {
		throw walletFailure(cause, 'wallet-sign-failed');
	}
}
