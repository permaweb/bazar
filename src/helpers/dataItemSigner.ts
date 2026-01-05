import { createAoSigner } from '@ar.io/sdk';
import { Web3Provider } from '@ethersproject/providers';
import { createData, DataItem, EthereumSigner, InjectedEthereumSigner, SIG_CONFIG } from '@dha-team/arbundles';
import { createDataItemSigner } from 'helpers/aoconnect';

import { getSessionKey, SessionKeyData } from 'providers/EvmWalletProvider';

export type ChainType = 'arweave' | 'evm';

interface SignOptions {
	data: string | Uint8Array;
	tags?: Array<{ name: string; value: string }>;
	target?: string;
	anchor?: string;
}

interface SignResult {
	id: string;
	raw: Uint8Array;
}

/**
 * Creates a unified DataItem signer that works for both Arweave and EVM chains
 * Uses session keys for EVM to avoid repeated MetaMask popups
 */
export function createUnifiedDataItemSigner(chain: ChainType) {
	if (chain === 'arweave') {
		// Arweave native signing via ArConnect/Othent
		return async ({ data, tags = [], target, anchor }: SignOptions): Promise<SignResult> => {
			if (!window.arweaveWallet) {
				throw new Error('No Arweave wallet connected');
			}

			const signed = await window.arweaveWallet.signDataItem({
				data,
				tags,
				anchor,
				target,
			});

			const dataItem = new DataItem(Buffer.from(signed));

			return {
				id: await dataItem.id,
				raw: await dataItem.getRaw(),
			};
		};
	}

	if (chain === 'evm') {
		// EVM signing with session key
		return async ({ data, tags = [], target, anchor }: SignOptions): Promise<SignResult> => {
			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					location: 'dataItemSigner.ts:50',
					message: 'createUnifiedDataItemSigner EVM entry',
					data: { hasEthereum: !!window.ethereum },
					timestamp: Date.now(),
					sessionId: 'debug-session',
					runId: 'run2',
					hypothesisId: 'G',
				}),
			}).catch(() => {});
			// #endregion

			if (!window.ethereum) {
				throw new Error('No Ethereum wallet available');
			}

			const mainAccount = window.ethereum.selectedAddress;
			if (!mainAccount) {
				throw new Error('No Ethereum account connected');
			}

			const sessionKey = getSessionKey(mainAccount);
			if (!sessionKey) {
				throw new Error('No session key available. Please reconnect your wallet.');
			}

			// Use EthereumSigner with session key private key
			const signer = new EthereumSigner(sessionKey.privateKey);

			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					location: 'dataItemSigner.ts:70',
					message: 'EthereumSigner created',
					data: { publicKeyLength: signer.publicKey?.length, address: signer.address },
					timestamp: Date.now(),
					sessionId: 'debug-session',
					runId: 'run3',
					hypothesisId: 'G',
				}),
			}).catch(() => {});
			// #endregion

			// Generate anchor if not provided (required for DataItem)
			const anchorValue =
				anchor ||
				Math.round(Date.now() / 1000)
					.toString()
					.padStart(32, Math.floor(Math.random() * 10).toString());

			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					location: 'dataItemSigner.ts:80',
					message: 'Before createData',
					data: { dataLength: data?.length, tagsCount: tags.length, anchor: anchorValue },
					timestamp: Date.now(),
					sessionId: 'debug-session',
					runId: 'run3',
					hypothesisId: 'H',
				}),
			}).catch(() => {});
			// #endregion

			// For Ethereum, we need to use signature type 2 (secp256k1)
			// SIG_CONFIG[2] exists but has pubLength:32, which is wrong for EthereumSigner
			// which produces 65-byte uncompressed public keys. Always use manual config.
			// Ethereum uses secp256k1: 65-byte public key (0x04 + 64 bytes), 65-byte signature
			const ethSigConfig = {
				signatureType: 2,
				pubLength: 65, // Ethereum uncompressed public key length
				sigLength: 65, // Ethereum signature length (r + s + v)
				ownerLength: 65, // Owner length matches pubLength for Ethereum
			};

			// Convert public key to Uint8Array if it's a Buffer
			const publicKey = signer.publicKey instanceof Uint8Array ? signer.publicKey : new Uint8Array(signer.publicKey);

			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					location: 'dataItemSigner.ts:90',
					message: 'Using manual Ethereum sig config',
					data: {
						ethSigConfig,
						actualPublicKeyLength: publicKey.length,
						publicKeyType: signer.publicKey?.constructor?.name,
					},
					timestamp: Date.now(),
					sessionId: 'debug-session',
					runId: 'run4',
					hypothesisId: 'L',
				}),
			}).catch(() => {});
			// #endregion

			const signerMeta = {
				...ethSigConfig,
				publicKey: publicKey,
			};

			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					location: 'dataItemSigner.ts:100',
					message: 'SignerMeta created',
					data: {
						ownerLength: signerMeta.ownerLength,
						pubLength: signerMeta.pubLength,
						publicKeyLength: signerMeta.publicKey?.length,
					},
					timestamp: Date.now(),
					sessionId: 'debug-session',
					runId: 'run4',
					hypothesisId: 'M',
				}),
			}).catch(() => {});
			// #endregion

			// Ensure data is Uint8Array
			const dataBytes =
				typeof data === 'string'
					? new TextEncoder().encode(data)
					: data instanceof Uint8Array
					? data
					: new Uint8Array(data);

			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					location: 'dataItemSigner.ts:115',
					message: 'Data format check',
					data: { dataBytesLength: dataBytes.length, dataType: typeof data },
					timestamp: Date.now(),
					sessionId: 'debug-session',
					runId: 'run4',
					hypothesisId: 'N',
				}),
			}).catch(() => {});
			// #endregion

			// For Ethereum, we MUST patch SIG_CONFIG[2] BEFORE calling createData
			// because createData uses SIG_CONFIG internally and will fail with "Owner must be 32 bytes"
			// Store original values to restore later
			const originalSigConfig = SIG_CONFIG?.[2];
			const originalPubLength = originalSigConfig?.pubLength;
			const originalOwnerLength = originalSigConfig?.ownerLength;
			const originalSigLength = originalSigConfig?.sigLength;

			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					location: 'dataItemSigner.ts:125',
					message: 'Patching SIG_CONFIG[2] BEFORE createData',
					data: { originalPubLength, originalOwnerLength, originalSigLength },
					timestamp: Date.now(),
					sessionId: 'debug-session',
					runId: 'run4',
					hypothesisId: 'P',
				}),
			}).catch(() => {});
			// #endregion

			// Temporarily patch SIG_CONFIG[2] to have correct lengths for Ethereum
			if (originalSigConfig) {
				originalSigConfig.pubLength = 65;
				originalSigConfig.ownerLength = 65;
				originalSigConfig.sigLength = 65;
			}

			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					location: 'dataItemSigner.ts:239',
					message: 'Before createData call',
					data: {
						dataBytesLength: dataBytes.length,
						tagsCount: tags.length,
						tagsTotalBytes: tags.reduce((sum, t) => sum + t.name.length + t.value.length, 0),
						maxTagNameLength: Math.max(...tags.map((t) => t.name.length), 0),
						maxTagValueLength: Math.max(...tags.map((t) => t.value.length), 0),
						tagNames: tags.map((t) => t.name),
						tagValueLengths: tags.map((t) => ({ name: t.name, length: t.value.length })),
					},
					timestamp: Date.now(),
					sessionId: 'debug-session',
					runId: 'run1',
					hypothesisId: 'J',
				}),
			}).catch(() => {});
			// #endregion

			let dataItem: any;
			try {
				// Now createData should work with the patched SIG_CONFIG[2]
				dataItem = createData(dataBytes, signer, {
					tags,
					target,
					anchor: anchorValue,
				});
				// #region agent log
				fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						location: 'dataItemSigner.ts:140',
						message: 'createData success (with patched SIG_CONFIG)',
						data: { dataItemId: dataItem.id },
						timestamp: Date.now(),
						sessionId: 'debug-session',
						runId: 'run4',
						hypothesisId: 'H',
					}),
				}).catch(() => {});
				// #endregion
			} catch (createDataError: any) {
				// #region agent log
				fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						location: 'dataItemSigner.ts:143',
						message: 'createData error even with patched SIG_CONFIG',
						data: { error: createDataError?.message, stack: createDataError?.stack },
						timestamp: Date.now(),
						sessionId: 'debug-session',
						runId: 'run4',
						hypothesisId: 'H',
					}),
				}).catch(() => {});
				// #endregion
				throw createDataError;
			} finally {
				// Restore original values
				if (originalSigConfig && originalPubLength !== undefined) {
					originalSigConfig.pubLength = originalPubLength;
					originalSigConfig.ownerLength = originalOwnerLength;
					originalSigConfig.sigLength = originalSigLength;
				}
			}

			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					location: 'dataItemSigner.ts:170',
					message: 'Before dataItem.sign',
					data: { dataItemId: dataItem.id },
					timestamp: Date.now(),
					sessionId: 'debug-session',
					runId: 'run3',
					hypothesisId: 'I',
				}),
			}).catch(() => {});
			// #endregion

			try {
				// Sign with the actual EthereumSigner
				await dataItem.sign(signer);
				// #region agent log
				fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						location: 'dataItemSigner.ts:125',
						message: 'dataItem.sign success',
						data: { dataItemId: dataItem.id },
						timestamp: Date.now(),
						sessionId: 'debug-session',
						runId: 'run3',
						hypothesisId: 'I',
					}),
				}).catch(() => {});
				// #endregion
			} catch (signError: any) {
				// #region agent log
				fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						location: 'dataItemSigner.ts:128',
						message: 'dataItem.sign error',
						data: { error: signError?.message, stack: signError?.stack },
						timestamp: Date.now(),
						sessionId: 'debug-session',
						runId: 'run3',
						hypothesisId: 'I',
					}),
				}).catch(() => {});
				// #endregion
				throw signError;
			}

			const raw = dataItem.getRaw();
			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					location: 'dataItemSigner.ts:115',
					message: 'DataItem complete',
					data: { id: dataItem.id, rawLength: raw.length },
					timestamp: Date.now(),
					sessionId: 'debug-session',
					runId: 'run2',
					hypothesisId: 'J',
				}),
			}).catch(() => {});
			// #endregion

			return {
				id: dataItem.id,
				raw: raw,
			};
		};
	}

	throw new Error(`Unsupported chain type: ${chain}`);
}

/**
 * Creates an AO signer for interacting with AO processes
 * Works with both Arweave wallets and EVM session keys
 * @param chain - The chain type ('arweave' or 'evm')
 * @param walletAddress - Optional wallet address for EVM (required for EVM when using RainbowKit)
 */
export function createAoSignerForChain(chain: ChainType, walletAddress?: string) {
	if (chain === 'arweave') {
		// Use existing Arweave wallet
		if (!window.arweaveWallet) {
			throw new Error('No Arweave wallet connected');
		}
		return createAoSigner(window.arweaveWallet);
	}

	if (chain === 'evm') {
		// For EVM, we need the wallet address to get the session key
		// Try walletAddress parameter first (from RainbowKit/wagmi), then fall back to window.ethereum
		let mainAccount: string | null = walletAddress || null;

		// Fall back to window.ethereum if walletAddress not provided (for compatibility)
		if (!mainAccount && window.ethereum && window.ethereum.selectedAddress) {
			mainAccount = window.ethereum.selectedAddress;
		}

		if (!mainAccount) {
			throw new Error('No Ethereum account connected. Please ensure your wallet is connected.');
		}

		// Normalize address to lowercase for consistent lookup
		const normalizedAddress = mainAccount.toLowerCase();
		const sessionKey = getSessionKey(normalizedAddress);

		if (!sessionKey) {
			console.error('Session key lookup failed for address:', normalizedAddress);
			console.error(
				'Available session keys in localStorage:',
				Object.keys(localStorage).filter((key) => key.startsWith('ethSessionKey_'))
			);
			throw new Error(
				`No session key available for address ${normalizedAddress.slice(
					0,
					10
				)}... Please reconnect your wallet to generate a session key.`
			);
		}

		console.log('Using session key for address:', normalizedAddress);

		// #region agent log
		fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				location: 'dataItemSigner.ts:135',
				message: 'createAoSignerForChain EVM entry',
				data: { normalizedAddress, hasSessionKey: !!sessionKey },
				timestamp: Date.now(),
				sessionId: 'debug-session',
				runId: 'run1',
				hypothesisId: 'A',
			}),
		}).catch(() => {});
		// #endregion

		// For EVM, we need to create a custom signer that implements the interface
		// expected by @permaweb/aoconnect. The signer should be a function that takes
		// `create` and `type` parameters.
		// Create arbundles signer from session key
		const arbundlesSigner = new EthereumSigner(sessionKey.privateKey);

		// Get the public key - EthereumSigner.publicKey is a Buffer
		const publicKeyBuffer = arbundlesSigner.publicKey;
		const publicKeyUint8 = new Uint8Array(publicKeyBuffer);

		// #region agent log
		fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				location: 'dataItemSigner.ts:145',
				message: 'Public key format check',
				data: {
					publicKeyBufferLength: publicKeyBuffer?.length,
					publicKeyUint8Length: publicKeyUint8?.length,
					firstBytes: Array.from(publicKeyUint8.slice(0, 5)),
				},
				timestamp: Date.now(),
				sessionId: 'debug-session',
				runId: 'run1',
				hypothesisId: 'A',
			}),
		}).catch(() => {});
		// #endregion

		// Create a custom signer function that matches the aoconnect interface
		// Based on the aoconnect README: async (create, type) => { ... }
		return async (
			create: (args: { publicKey: Uint8Array | string; alg?: string; type?: number }) => Promise<Uint8Array>,
			type: 'ans104' | 'httpsig'
		) => {
			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					location: 'dataItemSigner.ts:152',
					message: 'Signer function called',
					data: { type, publicKeyLength: publicKeyUint8.length },
					timestamp: Date.now(),
					sessionId: 'debug-session',
					runId: 'run1',
					hypothesisId: 'B',
				}),
			}).catch(() => {});
			// #endregion

			// The create function will provide us with the data to sign
			// We need to provide the public key and signature metadata
			// Note: aoconnect currently only supports type 1 (Arweave), but we'll try type 2 for Ethereum
			const createArgs = {
				publicKey: publicKeyUint8,
				alg: 'secp256k1', // Ethereum uses secp256k1
				type: 2, // Ethereum signature type (experimental)
			};

			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					location: 'dataItemSigner.ts:162',
					message: 'Before create() call',
					data: { publicKeyLength: createArgs.publicKey.length, alg: createArgs.alg, type: createArgs.type },
					timestamp: Date.now(),
					sessionId: 'debug-session',
					runId: 'run1',
					hypothesisId: 'C',
				}),
			}).catch(() => {});
			// #endregion

			let dataToSign: Uint8Array;
			try {
				dataToSign = await create(createArgs);
				// #region agent log
				fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						location: 'dataItemSigner.ts:169',
						message: 'After create() call',
						data: { dataToSignLength: dataToSign?.length },
						timestamp: Date.now(),
						sessionId: 'debug-session',
						runId: 'run1',
						hypothesisId: 'C',
					}),
				}).catch(() => {});
				// #endregion
			} catch (createError: any) {
				// #region agent log
				fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						location: 'dataItemSigner.ts:172',
						message: 'create() error',
						data: { error: createError?.message, stack: createError?.stack },
						timestamp: Date.now(),
						sessionId: 'debug-session',
						runId: 'run1',
						hypothesisId: 'C',
					}),
				}).catch(() => {});
				// #endregion
				throw createError;
			}

			// Sign the data using the arbundles signer
			// EthereumSigner.sign expects a Buffer or Uint8Array
			const signatureBuffer = await arbundlesSigner.sign(dataToSign);

			// Convert signature to Uint8Array
			const signature = signatureBuffer instanceof Uint8Array ? signatureBuffer : new Uint8Array(signatureBuffer);

			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					location: 'dataItemSigner.ts:185',
					message: 'Signer function exit',
					data: { signatureLength: signature.length, address: arbundlesSigner.address },
					timestamp: Date.now(),
					sessionId: 'debug-session',
					runId: 'run1',
					hypothesisId: 'D',
				}),
			}).catch(() => {});
			// #endregion

			// Return signature and address
			return {
				signature: signature,
				address: arbundlesSigner.address,
			};
		};
	}

	throw new Error(`Unsupported chain type: ${chain}`);
}

/**
 * Sign with main wallet (requires user confirmation)
 * Use this for important actions that need explicit user approval
 */
export function createDataItemSignerMain(chain: ChainType) {
	if (chain === 'arweave') {
		return async ({ data, tags = [], target, anchor }: SignOptions): Promise<SignResult> => {
			if (!window.arweaveWallet) {
				throw new Error('No Arweave wallet connected');
			}

			const signed = await window.arweaveWallet.signDataItem({
				data,
				tags,
				anchor,
				target,
			});

			const dataItem = new DataItem(Buffer.from(signed));

			return {
				id: await dataItem.id,
				raw: await dataItem.getRaw(),
			};
		};
	}

	if (chain === 'evm') {
		return async ({ data, tags = [], target, anchor }: SignOptions): Promise<SignResult> => {
			if (!window.ethereum) {
				throw new Error('No Ethereum wallet available');
			}

			const provider = new Web3Provider(window.ethereum);
			const signer = provider.getSigner();

			// This will prompt MetaMask for signature
			const address = await signer.getAddress();

			// Create EthereumSigner that will use the provider
			// Note: This requires user confirmation for each signature
			const ethSigner = new EthereumSigner(provider);
			await ethSigner.setPublicKey();

			const anchorValue =
				anchor ||
				Math.round(Date.now() / 1000)
					.toString()
					.padStart(32, Math.floor(Math.random() * 10).toString());

			const dataItem = createData(data, ethSigner, {
				tags,
				target,
				anchor: anchorValue,
			});

			await dataItem.sign(ethSigner);

			return {
				id: dataItem.id,
				raw: dataItem.getRaw(),
			};
		};
	}

	throw new Error(`Unsupported chain type: ${chain}`);
}

/**
 * Helper to get the active chain type based on connected wallets
 */
export function getActiveChain(): ChainType | null {
	// Check if Arweave wallet is connected
	if (window.arweaveWallet) {
		return 'arweave';
	}

	// Check if Ethereum wallet is connected
	if (window.ethereum && window.ethereum.selectedAddress) {
		return 'evm';
	}

	return null;
}

/**
 * Helper to check if a specific chain is available
 */
export function isChainAvailable(chain: ChainType): boolean {
	if (chain === 'arweave') {
		return !!window.arweaveWallet;
	}

	if (chain === 'evm') {
		return !!window.ethereum && !!window.ethereum.selectedAddress;
	}

	return false;
}
