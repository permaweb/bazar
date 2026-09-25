import { describe, expect, it } from 'vitest';

import { signWithWallet, walletFailure } from 'api/wallet/errors';

import { appError, appErrorMessage } from 'helpers/app-error';
import { APP_ERROR_MESSAGES } from 'helpers/app-error.messages';

describe('wallet failure mapping', () => {
	it.each([
		'User cancelled the AuthRequest',
		'User canceled the signature request',
		'Transaction signing was rejected by the user',
		'Permission denied',
		'The user declined this request',
	])('maps a declined approval (%s) to a neutral rejection', (text) => {
		const failure = walletFailure(new Error(text), 'wallet-sign-failed');
		expect(failure).toMatchObject({ reason: 'wallet-request-rejected', code: 'rejected' });
		expect(appErrorMessage(APP_ERROR_MESSAGES.en, failure)).toBe(
			'The wallet request was declined. Nothing was signed or sent.'
		);
	});

	it('uses the caller reason for a declined connection and the fallback for anything else', () => {
		expect(walletFailure('User rejected', 'wallet-connection-failed', 'wallet-connection-rejected').reason).toBe(
			'wallet-connection-rejected'
		);
		expect(walletFailure(new Error('extension crashed'), 'wallet-connection-failed')).toMatchObject({
			reason: 'wallet-connection-failed',
			code: 'unavailable',
		});
		expect(walletFailure(new DOMException('Aborted', 'AbortError'), 'wallet-sign-failed').code).toBe('cancelled');
		const existing = appError('wallet-account-changed');
		expect(walletFailure(existing, 'wallet-sign-failed')).toBe(existing);
	});

	it('signs through the wallet and maps a declined signature', async () => {
		const transaction = { id: 'unsigned' };
		await expect(signWithWallet(async () => undefined, transaction)).resolves.toBe(transaction);
		await expect(
			signWithWallet(async () => {
				throw new Error('User cancelled the signature');
			}, transaction)
		).rejects.toMatchObject({ reason: 'wallet-request-rejected' });
		await expect(
			signWithWallet(async () => {
				throw new Error('Internal extension error');
			}, transaction)
		).rejects.toMatchObject({ reason: 'wallet-sign-failed', code: 'unavailable' });
	});
});
