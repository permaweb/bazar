import { ConnectReturnType } from '@othent/kms';
import * as OTHENT_KMS from '@othent/kms';
import { jwtDecode } from 'jwt-decode';

import { SignatureOptions } from 'arweave/web/lib/crypto/crypto-interface';
import Transaction from 'arweave/web/lib/transaction';

export interface EncryptOptions {
	algorithm: string;
	hash: string;
	salt?: string;
}

export interface ArweaveConfig {
	host: string;
	port: number;
	protocol: 'http' | 'https';
}

function throwIf(condition: boolean, message: string, cause?: any) {
	if (condition) {
		const error: any = new Error(message, { cause });
		const stackFrames = error.stack.split('\n');
		stackFrames.splice(1, 1); // Remove the current stack frame (throwIf)
		error.stack = stackFrames.join('\n');
		throw error;
	}
}

class Othent {
	private static _userInfo: ConnectReturnType | null = null;
	private static readonly LS_KEY_ID_TOKEN = 'id_token';

	/**
	 * Initializes the Othent manager by mapping the Othent KMS API to the
	 * injected wallet API (window.arweaveWallet).
	 *
	 * Call this method one time before using any of the injected wallet API.
	 */
	static init() {
		window.arweaveWallet = {
			walletName: 'othent-kms',
			connect: () => this.connect(),
			disconnect: () => this.disconnect(),
			getActiveAddress: () => this.getActiveAddress(),
			getActivePublicKey: () => this.getActivePublicKey(),
			getAllAddresses: () => this.NOT_IMPLEMENTED<Promise<string[]>>('getAllAddresses'),
			getWalletNames: () => this.getWalletNames(),
			signature: (data: Uint8Array, algorithm: any) => this.signature(data, algorithm),
			sign: (tx: Transaction, options?: SignatureOptions) => this.signTx(tx, options),
			dispatch: (tx: Transaction, options?: SignatureOptions) => this.dispatch(tx, options),
			encrypt: async (data: string, _options: EncryptOptions) => this.encrypt(data),
			decrypt: async (data: Uint8Array, _options: EncryptOptions) => this.decrypt(data),
			getPermissions: () => this.NOT_IMPLEMENTED<Promise<any[]>>('getPermissions'),
			getArweaveConfig: () => this.NOT_IMPLEMENTED<Promise<ArweaveConfig>>('getArweaveConfig'),
			addToken: () => this.NOT_IMPLEMENTED<Promise<void>>('addToken'),
		};
	}

	static deInit() {
		// @ts-ignore: ArConnect didn't define null as potential value
		delete window.arweaveWallet;
	}

	/**
	 * Returns the Othent version of the Profile.
	 * Note that this is not ArProfile, but a derivation from the connected
	 * OAuth account.
	 */
	static getUserInfo() {
		return this._userInfo;
	}

	// --------------------------------------------------------------------------

	private constructor() {
		// no instance
	}

	private static async connect(): Promise<void> {
		try {
			const token = localStorage.getItem(this.LS_KEY_ID_TOKEN);
			throwIf(!token, 'Othent: no existing session. Proceed to re-connect');
			this._userInfo = this.decodeProfileFromToken(token!);
		} catch (e: any) {
			this._userInfo = await OTHENT_KMS.connect();
		}
	}

	private static async disconnect(): Promise<void> {
		console.log('disconnect');
		await OTHENT_KMS.disconnect();
		localStorage.removeItem(this.LS_KEY_ID_TOKEN);
		this.deInit();
	}

	private static async getActiveAddress(): Promise<string> {
		throwIf(!this._userInfo, 'Othent: no active session. Please call connect() first.');
		// @ts-ignore -- the type not updated?
		return this._userInfo?.walletAddress;
	}

	private static async getActivePublicKey(): Promise<string> {
		return OTHENT_KMS.getActivePublicKey();
	}

	private static async getWalletNames(): Promise<{ [addr: string]: string }> {
		const walletName = await OTHENT_KMS.getWalletNames();
		return { [await this.getActiveAddress()]: walletName };
	}

	private static async signature(data: Uint8Array, _algorithm: any): Promise<Buffer> {
		return OTHENT_KMS.signature(data);
	}

	private static async signTx(tx: Transaction, _options?: SignatureOptions) {
		return OTHENT_KMS.sign(tx);
	}

	private static async dispatch(tx: Transaction, _options?: SignatureOptions) {
		return OTHENT_KMS.dispatch(tx);
	}

	private static async encrypt(data: string): Promise<Uint8Array> {
		const encrypted = await OTHENT_KMS.encrypt(data);

		if (typeof encrypted === 'string') {
			const buffer = Buffer.from(encrypted, 'utf-8');
			return new Uint8Array(buffer);
		} else if (encrypted === null) {
			return new Uint8Array();
		} else {
			return encrypted;
		}
	}

	private static async decrypt(data: Uint8Array): Promise<string> {
		const decrypted = await OTHENT_KMS.decrypt(data);

		if (decrypted === null) {
			return '';
		} else if (decrypted instanceof Uint8Array) {
			return new TextDecoder().decode(decrypted);
		} else {
			return decrypted;
		}
	}

	private static NOT_IMPLEMENTED<T = void>(funcName: string): T {
		throw new Error(`Othent: "${funcName}" not implemented`);
	}

	private static decodeProfileFromToken(token: string): any {
		const decodedJwt: any = jwtDecode(token);
		delete decodedJwt.nonce;
		delete decodedJwt.sid;
		delete decodedJwt.aud;
		delete decodedJwt.iss;
		delete decodedJwt.iat;
		delete decodedJwt.exp;
		delete decodedJwt.updated_at;

		return decodedJwt;
	}
}

export default Othent;
