import { secp256k1 } from '@noble/curves/secp256k1.js';
import { describe, expect, it, vi } from 'vitest';

import Arweave from 'arweave';

import { ecdsaTransactionSignatureData, signedTransactionSignerAddress } from './arweave-transaction-signature';

describe('Arweave transaction signature verification', () => {
	it('recovers the Arweave address from an ownerless ECDSA signature', async () => {
		const { address, transaction } = await signedEcdsaTransaction();
		const ownerToAddress = vi.fn();

		await expect(signedTransactionSignerAddress(transaction, { ownerToAddress })).resolves.toBe(address);
		expect(ownerToAddress).not.toHaveBeenCalled();
	});

	it('binds ECDSA signed fields to the recovered signer', async () => {
		const { address, transaction } = await signedEcdsaTransaction();
		const modified = { ...transaction, reward: '124' };

		await expect(signedTransactionSignerAddress(modified, { ownerToAddress: vi.fn() })).resolves.not.toBe(address);
	});

	it('rejects an ECDSA transaction id that is not the signature hash', async () => {
		const { transaction } = await signedEcdsaTransaction();

		await expect(
			signedTransactionSignerAddress({ ...transaction, id: 'X'.repeat(43) }, { ownerToAddress: vi.fn() })
		).rejects.toThrow('signed-transaction-signature-invalid');
	});

	it('retains the Arweave.js RSA verification and owner-address path', async () => {
		const verifyRsa = vi.fn(async () => true);
		const ownerToAddress = vi.fn(async () => 'A'.repeat(43));
		const transaction = { id: 'T'.repeat(43), owner: 'rsa-owner' };

		await expect(signedTransactionSignerAddress(transaction, { ownerToAddress, verifyRsa })).resolves.toBe(
			'A'.repeat(43)
		);
		expect(verifyRsa).toHaveBeenCalledWith(transaction);
		expect(ownerToAddress).toHaveBeenCalledWith('rsa-owner');
	});
});

async function signedEcdsaTransaction() {
	const secretKey = secp256k1.utils.randomSecretKey();
	const publicKey = secp256k1.getPublicKey(secretKey, true);
	const transaction: Record<string, unknown> = {
		format: 2,
		owner: '',
		target: '',
		quantity: '0',
		reward: '123',
		last_tx: '',
		tags: [
			{
				name: Arweave.utils.stringToB64Url('action'),
				value: Arweave.utils.stringToB64Url('test'),
			},
		],
		data_size: '0',
		data_root: '',
	};
	const signatureData = await ecdsaTransactionSignatureData(transaction);
	const recoveredSignature = secp256k1.sign(signatureData, secretKey, { format: 'recovered' });
	const signature = new Uint8Array(65);
	signature.set(recoveredSignature.subarray(1), 0);
	signature[64] = recoveredSignature[0];
	transaction.signature = Arweave.utils.bufferTob64Url(signature);
	transaction.id = Arweave.utils.bufferTob64Url(await sha256(signature));
	return {
		address: Arweave.utils.bufferTob64Url(await sha256(publicKey)),
		transaction,
	};
}

async function sha256(value: Uint8Array): Promise<Uint8Array> {
	const input = new Uint8Array(value.byteLength);
	input.set(value);
	return new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', input));
}
