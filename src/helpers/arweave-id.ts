// Syntactic validation for 43-character base64url Arweave identifiers (wallet addresses, transaction
// IDs, data items, and AO process IDs). Syntax alone does not prove the resource exists or its type.
export const ARWEAVE_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export type ArweaveId = string & { readonly __brand: 'ArweaveId' };

export function isArweaveId(value: unknown): value is ArweaveId {
	return typeof value === 'string' && ARWEAVE_ID_PATTERN.test(value);
}
