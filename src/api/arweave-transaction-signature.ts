import { secp256k1 } from '@noble/curves/secp256k1.js';

import Arweave from 'arweave';
import deepHash from 'arweave/web/lib/deepHash';

const ARWEAVE_ID = /^[A-Za-z0-9_-]{43}$/;
const DECIMAL = /^\d+$/;

type SignedTransaction = Record<string, unknown> & {
	toJSON?: () => Record<string, unknown>;
};

export type SignedTransactionVerifier = {
	ownerToAddress(owner: string): Promise<string>;
	verifyRsa?: (transaction: SignedTransaction) => Promise<boolean>;
};

/**
 * Verifies a signed Arweave transaction and returns the address that signed it.
 *
 * RSA transactions carry their public key in `owner`; ECDSA transactions leave
 * `owner` empty and encode a recoverable secp256k1 signature instead.
 */
export async function signedTransactionSignerAddress(
	transaction: SignedTransaction,
	verifier: SignedTransactionVerifier
): Promise<string> {
	const directOwner = typeof transaction.owner === 'string' ? transaction.owner : undefined;
	if (directOwner) return rsaTransactionSignerAddress(transaction, directOwner, verifier);
	const serialized = serializableTransaction(transaction);
	const owner = String(serialized.owner ?? '');
	if (owner) {
		return rsaTransactionSignerAddress(transaction, owner, verifier);
	}
	return ecdsaTransactionSignerAddress(serialized);
}

async function rsaTransactionSignerAddress(
	transaction: SignedTransaction,
	owner: string,
	verifier: SignedTransactionVerifier
): Promise<string> {
	if (verifier.verifyRsa && !(await verifier.verifyRsa(transaction))) {
		throw new Error('signed-transaction-signature-invalid');
	}
	return verifier.ownerToAddress(owner);
}

export async function ecdsaTransactionSignatureData(transaction: Record<string, unknown>): Promise<Uint8Array> {
	if (String(transaction.format) !== '2' || String(transaction.owner ?? '') !== '') {
		throw new Error('signed-transaction-ecdsa-format-invalid');
	}
	const tags = transaction.tags;
	if (!Array.isArray(tags)) throw new Error('signed-transaction-tags-invalid');
	const tagList = tags.map((tag) => {
		if (!tag || typeof tag !== 'object') throw new Error('signed-transaction-tags-invalid');
		const raw = tag as Record<string, unknown>;
		return [decodeField(raw, 'name'), decodeField(raw, 'value')];
	});
	const fields: Array<Parameters<typeof deepHash>[0]> = [
		new TextEncoder().encode(String(transaction.format)),
		decodeField(transaction, 'target'),
		decimalField(transaction, 'quantity'),
		decimalField(transaction, 'reward'),
		decodeField(transaction, 'last_tx'),
		tagList as Parameters<typeof deepHash>[0],
		decimalField(transaction, 'data_size'),
		decodeField(transaction, 'data_root'),
	];
	const denomination = denominationField(transaction.denomination);
	return deepHash(denomination ? [denomination, ...fields] : fields);
}

async function ecdsaTransactionSignerAddress(transaction: Record<string, unknown>): Promise<string> {
	const id = textFieldValue(transaction, 'id');
	if (!ARWEAVE_ID.test(id)) throw new Error('signed-transaction-id-invalid');
	const signature = decodeField(transaction, 'signature');
	if (signature.byteLength !== 65 || signature[64] > 3) {
		throw new Error('signed-transaction-ecdsa-signature-invalid');
	}
	const expectedId = Arweave.utils.bufferTob64Url(await sha256(signature));
	if (id !== expectedId) throw new Error('signed-transaction-signature-invalid');

	const recoverableSignature = new Uint8Array(65);
	recoverableSignature[0] = signature[64];
	recoverableSignature.set(signature.subarray(0, 64), 1);
	const signatureData = await ecdsaTransactionSignatureData(transaction);
	const recoveredPublicKey = secp256k1.recoverPublicKey(recoverableSignature, signatureData);
	if (!secp256k1.verify(signature.subarray(0, 64), signatureData, recoveredPublicKey)) {
		throw new Error('signed-transaction-signature-invalid');
	}
	const compressedPublicKey = secp256k1.Point.fromBytes(recoveredPublicKey).toBytes(true);
	return Arweave.utils.bufferTob64Url(await sha256(compressedPublicKey));
}

function serializableTransaction(transaction: SignedTransaction): Record<string, unknown> {
	const serialized = typeof transaction.toJSON === 'function' ? transaction.toJSON() : transaction;
	return { ...serialized, id: transaction.id ?? serialized.id, owner: transaction.owner ?? serialized.owner };
}

function decodeField(value: Record<string, unknown>, field: string): Uint8Array {
	return Arweave.utils.b64UrlToBuffer(textFieldValue(value, field));
}

function decimalField(value: Record<string, unknown>, field: string): Uint8Array {
	const raw = textFieldValue(value, field);
	if (!DECIMAL.test(raw)) throw new Error(`signed-transaction-${field}-invalid`);
	return new TextEncoder().encode(raw);
}

function denominationField(value: unknown): Uint8Array | undefined {
	if (value === undefined || value === null || value === '' || value === 0 || value === '0') return undefined;
	const raw = String(value);
	if (!DECIMAL.test(raw) || BigInt(raw) <= 0n) throw new Error('signed-transaction-denomination-invalid');
	return new TextEncoder().encode(raw);
}

function textFieldValue(value: Record<string, unknown>, field: string): string {
	const raw = value[field];
	if (typeof raw !== 'string') throw new Error(`signed-transaction-${field}-invalid`);
	return raw;
}

async function sha256(value: Uint8Array): Promise<Uint8Array> {
	const digestInput = new Uint8Array(value.byteLength);
	digestInput.set(value);
	return new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', digestInput));
}
