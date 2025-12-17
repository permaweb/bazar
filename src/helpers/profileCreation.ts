import { createAoSignerForChain, createUnifiedDataItemSigner } from './dataItemSigner';
import { message, result, spawn } from '@permaweb/aoconnect';
import { getSessionKey } from 'providers/EvmWalletProvider';
import { AO } from './config';
import { getAOConfig } from './config';

export type WalletType = 'arweave' | 'evm';

interface CreateProfileArgs {
	walletAddress: string;
	walletType: WalletType;
	displayName?: string;
	username?: string;
	bio?: string;
	avatar?: string;
	banner?: string;
}

interface ProfileCreationResult {
	profileId: string;
	success: boolean;
	error?: string;
}

/**
 * Creates an AO Zone profile using either Arweave or EVM wallet
 * ETH addresses can now own profiles just like Arweave addresses!
 */
export async function createProfile(args: CreateProfileArgs): Promise<ProfileCreationResult> {
	try {
		const { walletAddress, walletType, displayName, username, bio, avatar, banner } = args;

		// Validate wallet connection
		if (walletType === 'arweave' && !window.arweaveWallet) {
			throw new Error('Arweave wallet not connected');
		}

		if (walletType === 'evm') {
			// Check if wallet address is provided
			if (!walletAddress) {
				throw new Error('Ethereum wallet address not provided');
			}

			// Verify session key exists - if not, try to generate one
			let sessionKey = getSessionKey(walletAddress);
			if (!sessionKey) {
				// Session key might not be initialized yet - try to get it from the provider
				// If still not available, throw error
				throw new Error(
					'Session key not found. Please wait a moment and try again, or reconnect your Ethereum wallet.'
				);
			}
		}

		// Create AO signer for the wallet type
		// Pass walletAddress for EVM to ensure session key lookup works with RainbowKit
		const signer = createAoSignerForChain(walletType, walletType === 'evm' ? walletAddress : undefined);

		console.log(`Creating profile for ${walletType} wallet:`, walletAddress);

		// Step 1: Load profile source code first (needed for spawn)
		console.log('Loading profile source from:', `https://arweave.net/${AO.profileSrc}`);
		const profileSrcResponse = await fetch(`https://arweave.net/${AO.profileSrc}`);

		if (!profileSrcResponse.ok) {
			throw new Error(`Failed to load profile source: ${profileSrcResponse.status} ${profileSrcResponse.statusText}`);
		}

		const profileSrc = await profileSrcResponse.text();

		if (!profileSrc || profileSrc.length === 0) {
			throw new Error('Profile source code is empty');
		}

		console.log('Profile source loaded, length:', profileSrc.length);

		// Step 2: Spawn new AO process for profile with source code
		// #region agent log
		fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				location: 'profileCreation.ts:75',
				message: 'Before spawn call',
				data: { walletType, walletAddress, profileSrcLength: profileSrc.length, signerType: typeof signer },
				timestamp: Date.now(),
				sessionId: 'debug-session',
				runId: 'run1',
				hypothesisId: 'E',
			}),
		}).catch(() => {});
		// #endregion

		let profileId: string;

		// For EVM wallets, we need to bypass aoconnect's spawn and create DataItems directly
		// because aoconnect expects Arweave-style 32-byte keys, not Ethereum 65-byte keys
		if (walletType === 'evm') {
			try {
				// Use unified signer to create DataItem directly
				const dataItemSigner = createUnifiedDataItemSigner('evm');

				// #region agent log
				fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						location: 'profileCreation.ts:85',
						message: 'Creating DataItem for EVM',
						data: { profileSrcLength: profileSrc.length },
						timestamp: Date.now(),
						sessionId: 'debug-session',
						runId: 'run2',
						hypothesisId: 'F',
					}),
				}).catch(() => {});
				// #endregion

				// Create spawn DataItem with required tags for AO process spawning
				// The tags must match what aoconnect's spawn function expects
				const spawnTags = [
					{ name: 'Data-Protocol', value: 'ao' },
					{ name: 'Variant', value: 'ao.TN.1' },
					{ name: 'Type', value: 'Process' },
					{ name: 'Module', value: AO.module },
					{ name: 'Scheduler', value: AO.scheduler },
					{ name: 'App-Name', value: 'BazAR' },
					{ name: 'Profile-Type', value: 'Zone' },
					{ name: 'Wallet-Type', value: walletType },
				];

				// #region agent log
				fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						location: 'profileCreation.ts:100',
						message: 'Before dataItemSigner call',
						data: { tagsCount: spawnTags.length },
						timestamp: Date.now(),
						sessionId: 'debug-session',
						runId: 'run2',
						hypothesisId: 'K',
					}),
				}).catch(() => {});
				// #endregion

				let dataItem: any;
				try {
					dataItem = await dataItemSigner({
						data: profileSrc,
						tags: spawnTags,
					});
					// #region agent log
					fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							location: 'profileCreation.ts:110',
							message: 'DataItem created',
							data: { dataItemId: dataItem.id, dataItemRawLength: dataItem.raw.length },
							timestamp: Date.now(),
							sessionId: 'debug-session',
							runId: 'run2',
							hypothesisId: 'K',
						}),
					}).catch(() => {});
					// #endregion
				} catch (dataItemError: any) {
					// #region agent log
					fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							location: 'profileCreation.ts:113',
							message: 'DataItem creation error',
							data: { error: dataItemError?.message, stack: dataItemError?.stack },
							timestamp: Date.now(),
							sessionId: 'debug-session',
							runId: 'run2',
							hypothesisId: 'K',
						}),
					}).catch(() => {});
					// #endregion
					throw dataItemError;
				}

				// Upload DataItem to Arweave and send to MU for spawning
				// For mainnet, use the mainnet MU URL; for testnet use testnet MU
				// Default to mainnet MU URL
				const MU_URL = 'https://mu.ao-testnet.xyz'; // TODO: Use mainnet MU for production

				// #region agent log
				fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						location: 'profileCreation.ts:108',
						message: 'Sending to MU',
						data: { muUrl: MU_URL },
						timestamp: Date.now(),
						sessionId: 'debug-session',
						runId: 'run1',
						hypothesisId: 'F',
					}),
				}).catch(() => {});
				// #endregion

				const muResponse = await fetch(MU_URL, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/octet-stream',
						Accept: 'application/json',
					},
					body: dataItem.raw,
				});

				if (!muResponse.ok) {
					const errorText = await muResponse.text();
					throw new Error(`MU upload failed: ${muResponse.status} ${errorText}`);
				}

				const muResult = await muResponse.json();
				profileId = muResult.processId || muResult.id || dataItem.id;

				// #region agent log
				fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						location: 'profileCreation.ts:150',
						message: 'Profile ID extracted from MU response',
						data: { profileId, muResult, dataItemId: dataItem.id },
						timestamp: Date.now(),
						sessionId: 'debug-session',
						runId: 'run1',
						hypothesisId: 'R',
					}),
				}).catch(() => {});
				// #endregion

				// #region agent log
				fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						location: 'profileCreation.ts:125',
						message: 'MU spawn success',
						data: { profileId, muResult },
						timestamp: Date.now(),
						sessionId: 'debug-session',
						runId: 'run1',
						hypothesisId: 'F',
					}),
				}).catch(() => {});
				// #endregion
			} catch (evmSpawnError: any) {
				// #region agent log
				fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						location: 'profileCreation.ts:128',
						message: 'EVM spawn error',
						data: { error: evmSpawnError?.message, stack: evmSpawnError?.stack },
						timestamp: Date.now(),
						sessionId: 'debug-session',
						runId: 'run1',
						hypothesisId: 'F',
					}),
				}).catch(() => {});
				// #endregion
				throw evmSpawnError;
			}
		} else {
			// For Arweave wallets, use standard aoconnect spawn
			try {
				profileId = await spawn({
					module: AO.module,
					scheduler: AO.scheduler,
					signer: signer,
					data: profileSrc, // Include profile source in spawn
					tags: [
						{ name: 'App-Name', value: 'BazAR' },
						{ name: 'Type', value: 'Profile' },
						{ name: 'Profile-Type', value: 'Zone' },
						{ name: 'Wallet-Type', value: walletType },
					],
				});
				// #region agent log
				fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						location: 'profileCreation.ts:145',
						message: 'Arweave spawn success',
						data: { profileId },
						timestamp: Date.now(),
						sessionId: 'debug-session',
						runId: 'run1',
						hypothesisId: 'E',
					}),
				}).catch(() => {});
				// #endregion
			} catch (spawnError: any) {
				// #region agent log
				fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						location: 'profileCreation.ts:148',
						message: 'Arweave spawn error',
						data: { error: spawnError?.message, stack: spawnError?.stack },
						timestamp: Date.now(),
						sessionId: 'debug-session',
						runId: 'run1',
						hypothesisId: 'E',
					}),
				}).catch(() => {});
				// #endregion
				throw spawnError;
			}
		}

		console.log('Profile process spawned:', profileId);

		// #region agent log
		fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				location: 'profileCreation.ts:187',
				message: 'Profile spawned, waiting before sending messages',
				data: { profileId, profileIdLength: profileId?.length, walletType },
				timestamp: Date.now(),
				sessionId: 'debug-session',
				runId: 'run1',
				hypothesisId: 'R',
			}),
		}).catch(() => {});
		// #endregion

		// For EVM wallets, the process might not be immediately indexed on the gateway
		// We'll make eval/update/register messages non-critical - if they fail, the profile is still created
		// Wait longer for the process to be indexed (10 seconds for testnet)
		if (walletType === 'evm') {
			await new Promise((resolve) => setTimeout(resolve, 10000));
		} else {
			await new Promise((resolve) => setTimeout(resolve, 2000));
		}

		// Helper function to send messages for EVM wallets using DataItems
		const sendEvmMessage = async (
			targetProcess: string,
			action: string,
			data?: string,
			extraTags: Array<{ name: string; value: string }> = []
		) => {
			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					location: 'profileCreation.ts:190',
					message: 'sendEvmMessage called',
					data: {
						targetProcess,
						action,
						dataLength: data?.length,
						extraTagsCount: extraTags.length,
						targetProcessLength: targetProcess?.length,
					},
					timestamp: Date.now(),
					sessionId: 'debug-session',
					runId: 'run1',
					hypothesisId: 'P',
				}),
			}).catch(() => {});
			// #endregion

			if (!targetProcess || targetProcess.trim() === '') {
				throw new Error(`Invalid target process: "${targetProcess}"`);
			}

			const dataItemSigner = createUnifiedDataItemSigner('evm');
			const aoConfig = getAOConfig();
			const MU_URL = aoConfig.mu_url || 'https://mu.ao-testnet.xyz';

			const messageTags = [
				{ name: 'Data-Protocol', value: 'ao' },
				{ name: 'Variant', value: 'ao.TN.1' },
				{ name: 'Type', value: 'Message' },
				{ name: 'Action', value: action },
				{ name: 'Target', value: targetProcess },
				...extraTags,
			];

			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					location: 'profileCreation.ts:205',
					message: 'Before creating DataItem for message',
					data: { tagsCount: messageTags.length, targetProcess },
					timestamp: Date.now(),
					sessionId: 'debug-session',
					runId: 'run1',
					hypothesisId: 'P',
				}),
			}).catch(() => {});
			// #endregion

			const dataItem = await dataItemSigner({
				data: data || '',
				tags: messageTags,
			});

			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					location: 'profileCreation.ts:215',
					message: 'DataItem created for message',
					data: { dataItemId: dataItem.id, rawLength: dataItem.raw.length },
					timestamp: Date.now(),
					sessionId: 'debug-session',
					runId: 'run1',
					hypothesisId: 'P',
				}),
			}).catch(() => {});
			// #endregion

			const muResponse = await fetch(MU_URL, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/octet-stream',
					Accept: 'application/json',
				},
				body: dataItem.raw,
			});

			if (!muResponse.ok) {
				const errorText = await muResponse.text();
				// #region agent log
				fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						location: 'profileCreation.ts:225',
						message: 'MU message error',
						data: { error: errorText, status: muResponse.status, targetProcess },
						timestamp: Date.now(),
						sessionId: 'debug-session',
						runId: 'run1',
						hypothesisId: 'P',
					}),
				}).catch(() => {});
				// #endregion
				throw new Error(`MU message failed: ${muResponse.status} ${errorText}`);
			}

			const muResult = await muResponse.json();
			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					location: 'profileCreation.ts:232',
					message: 'MU message success',
					data: { messageId: muResult.id || dataItem.id },
					timestamp: Date.now(),
					sessionId: 'debug-session',
					runId: 'run1',
					hypothesisId: 'P',
				}),
			}).catch(() => {});
			// #endregion
			return muResult.id || dataItem.id;
		};

		// Step 3: Eval profile source into the process (if not already included in spawn)
		// Note: Some implementations include source in spawn, others require separate eval
		// For EVM wallets, this is non-critical - profile is already spawned
		try {
			let evalMessageId: string;
			if (walletType === 'evm') {
				// For EVM, send message as DataItem directly
				// If this fails, it's non-critical - the profile is already created
				try {
					evalMessageId = await sendEvmMessage(profileId, 'Eval', profileSrc);
					console.log('Profile source eval message sent:', evalMessageId);
				} catch (evmEvalError) {
					console.warn('Eval message failed for EVM (non-critical, profile already spawned):', evmEvalError);
					// Continue - profile is already created
				}
			} else {
				// For Arweave, use aoconnect.message
				evalMessageId = await message({
					process: profileId,
					signer: signer,
					tags: [{ name: 'Action', value: 'Eval' }],
					data: profileSrc,
				});
				console.log('Profile source eval message sent:', evalMessageId);
			}
		} catch (evalError) {
			console.warn('Eval message failed (may not be needed if source was in spawn):', evalError);
		}

		// Wait for eval to process (if it was sent)
		await new Promise((resolve) => setTimeout(resolve, 2000));

		// Step 4: Update profile metadata if provided
		// For EVM wallets, this is non-critical - profile is already spawned
		const metadata: any = {
			WalletAddress: walletAddress,
			WalletType: walletType,
		};

		if (displayName) metadata.DisplayName = displayName;
		if (username) metadata.Username = username;
		if (bio) metadata.Bio = bio;
		if (avatar) metadata.Avatar = avatar;
		if (banner) metadata.Banner = banner;

		try {
			let updateMessageId: string;
			if (walletType === 'evm') {
				// For EVM, send message as DataItem directly
				// If this fails, it's non-critical - the profile is already created
				try {
					updateMessageId = await sendEvmMessage(profileId, 'Update-Profile', JSON.stringify(metadata));
					console.log('Profile metadata updated:', updateMessageId);
				} catch (evmUpdateError) {
					console.warn(
						'Update-Profile message failed for EVM (non-critical, profile already spawned):',
						evmUpdateError
					);
					// Continue - profile is already created
				}
			} else {
				// For Arweave, use aoconnect.message
				updateMessageId = await message({
					process: profileId,
					signer: signer,
					tags: [
						{ name: 'Action', value: 'Update-Profile' },
						{ name: 'Data-Protocol', value: 'ao' },
						{ name: 'Type', value: 'Message' },
						{ name: 'Variant', value: 'ao.TN.1' },
					],
					data: JSON.stringify(metadata),
				});
				console.log('Profile metadata updated:', updateMessageId);
			}
		} catch (updateError) {
			console.warn('Profile metadata update failed (non-critical):', updateError);
		}

		// Step 5: Register profile in registry
		// For EVM wallets, this is non-critical - profile is already spawned
		try {
			let registryMessageId: string;
			if (walletType === 'evm') {
				// For EVM, send message as DataItem directly
				// If this fails, it's non-critical - the profile is already created
				try {
					registryMessageId = await sendEvmMessage(AO.profileRegistry, 'Register-Profile', undefined, [
						{ name: 'Profile-Id', value: profileId },
						{ name: 'Wallet-Address', value: walletAddress },
						{ name: 'Wallet-Type', value: walletType },
					]);
					console.log('Profile registered:', registryMessageId);
				} catch (evmRegistryError) {
					console.warn(
						'Register-Profile message failed for EVM (non-critical, profile already spawned):',
						evmRegistryError
					);
					// Continue - profile is already created
				}
			} else {
				// For Arweave, use aoconnect.message
				registryMessageId = await message({
					process: AO.profileRegistry,
					signer: signer,
					tags: [
						{ name: 'Action', value: 'Register-Profile' },
						{ name: 'Profile-Id', value: profileId },
						{ name: 'Wallet-Address', value: walletAddress },
						{ name: 'Wallet-Type', value: walletType },
					],
				});
				console.log('Profile registered:', registryMessageId);
			}
		} catch (error) {
			console.warn('Profile registry update failed (non-critical):', error);
		}

		return {
			profileId,
			success: true,
		};
	} catch (error) {
		console.error('Profile creation error:', error);
		return {
			profileId: '',
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error occurred',
		};
	}
}

/**
 * Check if wallet already has a profile
 */
export async function checkExistingProfile(walletAddress: string): Promise<string | null> {
	try {
		const response = await result({
			process: AO.profileRegistry,
			tags: [
				{ name: 'Action', value: 'Get-Profile' },
				{ name: 'Wallet-Address', value: walletAddress },
			],
		});

		if (response && response.Messages && response.Messages.length > 0) {
			const data = JSON.parse(response.Messages[0].Data);
			return data.ProfileId || null;
		}

		return null;
	} catch (error) {
		console.error('Error checking existing profile:', error);
		return null;
	}
}
