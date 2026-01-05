import { createAoSignerForChain, createUnifiedDataItemSigner } from './dataItemSigner';
import { message, result, spawn, dryrun } from '@permaweb/aoconnect';
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

			// CRITICAL: Check if profile already exists BEFORE creating a new one
			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					location: 'profileCreation.ts:29',
					message: 'createProfile: Checking for existing profile before creation',
					data: { walletAddress, walletType },
					timestamp: Date.now(),
					sessionId: 'debug-session',
					runId: 'run1',
					hypothesisId: 'LL',
				}),
			}).catch(() => {});
			// #endregion

			const existingProfileId = await checkExistingProfile(walletAddress);
			if (existingProfileId) {
				// #region agent log
				fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						location: 'profileCreation.ts:45',
						message: 'createProfile: Profile already exists, returning existing ID',
						data: { walletAddress, existingProfileId },
						timestamp: Date.now(),
						sessionId: 'debug-session',
						runId: 'run1',
						hypothesisId: 'LL',
					}),
				}).catch(() => {});
				// #endregion
				return {
					profileId: existingProfileId,
					success: true,
				};
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

		// CRITICAL: Cache profile ID immediately after spawn (before registration)
		// This prevents duplicate creation even if registration fails
		if (walletType === 'evm') {
			const cacheKey = `ethProfile_${walletAddress.toLowerCase()}`;
			localStorage.setItem(cacheKey, profileId);
			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					location: 'profileCreation.ts:325',
					message: 'Profile ID cached immediately after spawn',
					data: { profileId, cacheKey, walletAddress, walletType },
					timestamp: Date.now(),
					sessionId: 'debug-session',
					runId: 'run1',
					hypothesisId: 'GG',
				}),
			}).catch(() => {});
			// #endregion
		}

		// #region agent log
		fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				location: 'profileCreation.ts:345',
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

		// Step 3: Send Init message (matching permaweb-libs pattern)
		// permaweb-libs sends an Init message after spawn to initialize the process
		// The On-Boot tag will automatically load the zone source code, so we don't need Eval
		try {
			let initMessageId: string;
			if (walletType === 'evm') {
				// For EVM, send Init message as DataItem directly
				// If this fails, it's non-critical - the profile is already spawned
				try {
					initMessageId = await sendEvmMessage(profileId, 'Init', undefined, []);
					console.log('Init message sent:', initMessageId);
				} catch (evmInitError) {
					console.warn('Init message failed for EVM (non-critical, profile already spawned):', evmInitError);
					// Continue - profile is already created
				}
			} else {
				// For Arweave, use aoconnect.message
				initMessageId = await message({
					process: profileId,
					signer: signer,
					tags: [{ name: 'Action', value: 'Init' }],
				});
				console.log('Init message sent:', initMessageId);
			}
		} catch (initError) {
			console.warn('Init message failed (non-critical):', initError);
		}

		// Wait for process to initialize
		await new Promise((resolve) => setTimeout(resolve, 2000));

		// Step 4: Update profile metadata if provided
		// For EVM wallets, this is non-critical - profile is already spawned
		// Use Zone-Update action with [{key, value}, ...] format matching process_zone.lua expectations
		// This matches permaweb-libs.updateProfile format (see permaweb-libs/sdk/src/services/zones.ts)
		const dataEntries: Array<{ key: string; value: string }> = [];

		// Add wallet metadata
		dataEntries.push({ key: 'WalletAddress', value: walletAddress });
		dataEntries.push({ key: 'WalletType', value: walletType });

		// Add profile fields if provided
		if (displayName) dataEntries.push({ key: 'DisplayName', value: displayName });
		if (username) dataEntries.push({ key: 'Username', value: username });
		if (bio) dataEntries.push({ key: 'Description', value: bio });
		if (avatar) {
			dataEntries.push({ key: 'Thumbnail', value: avatar });
		} else {
			// permaweb-libs sets Thumbnail to 'None' if not provided
			dataEntries.push({ key: 'Thumbnail', value: 'None' });
		}
		if (banner) {
			dataEntries.push({ key: 'Banner', value: banner });
		} else {
			// permaweb-libs sets Banner to 'None' if not provided
			dataEntries.push({ key: 'Banner', value: 'None' });
		}

		// Format data as JSON string (zone process expects JSON array)
		const dataJson = JSON.stringify(dataEntries);

		// Build message tags matching permaweb-libs format
		const updateTags: Array<{ name: string; value: string }> = [
			{ name: 'Data-Protocol', value: 'ao' },
			{ name: 'Variant', value: 'ao.TN.1' },
			{ name: 'Type', value: 'Message' },
			{ name: 'Action', value: 'Zone-Update' }, // Use Zone-Update instead of Update-Profile
			{ name: 'Target', value: profileId },
		];

		try {
			let updateMessageId: string;
			if (walletType === 'evm') {
				// For EVM, send message as DataItem directly
				// If this fails, it's non-critical - the profile is already created
				try {
					updateMessageId = await sendEvmMessage(profileId, 'Zone-Update', dataJson, []);
					console.log('Profile metadata updated:', updateMessageId);
				} catch (evmUpdateError) {
					console.warn('Zone-Update message failed for EVM (non-critical, profile already spawned):', evmUpdateError);
					// Continue - profile is already created
				}
			} else {
				// For Arweave, use aoconnect.message
				updateMessageId = await message({
					process: profileId,
					signer: signer,
					tags: updateTags,
					data: dataJson, // Include the data in the message
				});
				console.log('Profile metadata updated:', updateMessageId);
			}
		} catch (updateError) {
			console.warn('Profile metadata update failed (non-critical):', updateError);
		}

		// Step 5: Register profile in registry
		// For EVM wallets, this is non-critical - profile is already spawned and cached
		// If registration fails, the profile is still usable (it's cached in localStorage)
		try {
			let registryMessageId: string;
			if (walletType === 'evm') {
				// For EVM, send message as DataItem directly
				// If this fails, it's non-critical - the profile is already created and cached
				try {
					// #region agent log
					fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							location: 'profileCreation.ts:590',
							message: 'Attempting to register profile in registry',
							data: { profileId, walletAddress, walletType, profileRegistry: AO.profileRegistry },
							timestamp: Date.now(),
							sessionId: 'debug-session',
							runId: 'run1',
							hypothesisId: 'HH',
						}),
					}).catch(() => {});
					// #endregion

					registryMessageId = await sendEvmMessage(AO.profileRegistry, 'Register-Profile', undefined, [
						{ name: 'Profile-Id', value: profileId },
						{ name: 'Wallet-Address', value: walletAddress },
						{ name: 'Wallet-Type', value: walletType },
					]);
					console.log('Profile registered:', registryMessageId);
					// #region agent log
					fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							location: 'profileCreation.ts:605',
							message: 'Profile successfully registered in registry',
							data: { profileId, registryMessageId },
							timestamp: Date.now(),
							sessionId: 'debug-session',
							runId: 'run1',
							hypothesisId: 'HH',
						}),
					}).catch(() => {});
					// #endregion
				} catch (evmRegistryError) {
					// #region agent log
					fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							location: 'profileCreation.ts:620',
							message: 'Register-Profile failed (non-critical, profile already cached)',
							data: {
								profileId,
								error: evmRegistryError instanceof Error ? evmRegistryError.message : String(evmRegistryError),
								walletAddress,
								note: 'Profile is still usable - cached in localStorage',
							},
							timestamp: Date.now(),
							sessionId: 'debug-session',
							runId: 'run1',
							hypothesisId: 'HH',
						}),
					}).catch(() => {});
					// #endregion
					console.warn(
						'Register-Profile message failed for EVM (non-critical, profile already spawned and cached):',
						evmRegistryError
					);
					// Continue - profile is already created and cached
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
 * Checks localStorage first (fastest), then registry (most reliable)
 */
export async function checkExistingProfile(walletAddress: string): Promise<string | null> {
	const startTime = Date.now();
	// #region agent log
	fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			location: 'profileCreation.ts:712',
			message: 'checkExistingProfile: Starting check',
			data: { walletAddress, profileRegistry: AO.profileRegistry },
			timestamp: Date.now(),
			sessionId: 'debug-session',
			runId: 'run1',
			hypothesisId: 'DD',
		}),
	}).catch(() => {});
	// #endregion

	// FIRST: Check localStorage cache (fastest, most reliable for recently created profiles)
	const cacheKey = `ethProfile_${walletAddress.toLowerCase()}`;
	const cachedProfileId = localStorage.getItem(cacheKey);
	if (cachedProfileId) {
		// #region agent log
		fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				location: 'profileCreation.ts:730',
				message: 'checkExistingProfile: Found in localStorage cache',
				data: { walletAddress, cachedProfileId, cacheKey, elapsed: Date.now() - startTime },
				timestamp: Date.now(),
				sessionId: 'debug-session',
				runId: 'run1',
				hypothesisId: 'DD',
			}),
		}).catch(() => {});
		// #endregion
		return cachedProfileId;
	}

	try {
		// Use dryrun to query the registry (result requires a message ID, not tags)
		// dryrun simulates a message execution without actually sending it
		const response = await dryrun({
			process: AO.profileRegistry,
			tags: [
				{ name: 'Action', value: 'Get-Profile' },
				{ name: 'Wallet-Address', value: walletAddress },
			],
		});

		const elapsed = Date.now() - startTime;

		// #region agent log
		fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				location: 'profileCreation.ts:660',
				message: 'checkExistingProfile: Registry response received',
				data: {
					walletAddress,
					hasResponse: !!response,
					hasMessages: !!(response && response.Messages),
					messagesLength: response?.Messages?.length || 0,
					responseKeys: response ? Object.keys(response) : [],
					elapsed,
				},
				timestamp: Date.now(),
				sessionId: 'debug-session',
				runId: 'run1',
				hypothesisId: 'DD',
			}),
		}).catch(() => {});
		// #endregion

		if (response && response.Messages && response.Messages.length > 0) {
			try {
				const data = JSON.parse(response.Messages[0].Data);
				const profileId = data.ProfileId || null;

				// #region agent log
				fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						location: 'profileCreation.ts:685',
						message: 'checkExistingProfile: Profile found',
						data: {
							walletAddress,
							profileId,
							parsedData: data,
							rawData: response.Messages[0].Data,
							elapsed,
						},
						timestamp: Date.now(),
						sessionId: 'debug-session',
						runId: 'run1',
						hypothesisId: 'DD',
					}),
				}).catch(() => {});
				// #endregion

				return profileId;
			} catch (parseError) {
				// #region agent log
				fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						location: 'profileCreation.ts:705',
						message: 'checkExistingProfile: Failed to parse response',
						data: {
							walletAddress,
							parseError: parseError instanceof Error ? parseError.message : String(parseError),
							rawData: response.Messages[0].Data,
							elapsed,
						},
						timestamp: Date.now(),
						sessionId: 'debug-session',
						runId: 'run1',
						hypothesisId: 'DD',
					}),
				}).catch(() => {});
				// #endregion
				console.error('Error parsing profile registry response:', parseError);
				return null;
			}
		}

		// #region agent log
		fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				location: 'profileCreation.ts:725',
				message: 'checkExistingProfile: No profile found',
				data: { walletAddress, elapsed, response: response ? 'exists but no messages' : 'null' },
				timestamp: Date.now(),
				sessionId: 'debug-session',
				runId: 'run1',
				hypothesisId: 'DD',
			}),
		}).catch(() => {});
		// #endregion

		return null;
	} catch (error) {
		const elapsed = Date.now() - startTime;
		// #region agent log
		fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				location: 'profileCreation.ts:740',
				message: 'checkExistingProfile: Error occurred',
				data: {
					walletAddress,
					error: error instanceof Error ? error.message : String(error),
					errorStack: error instanceof Error ? error.stack : undefined,
					elapsed,
				},
				timestamp: Date.now(),
				sessionId: 'debug-session',
				runId: 'run1',
				hypothesisId: 'DD',
			}),
		}).catch(() => {});
		// #endregion
		console.error('Error checking existing profile:', error);
		return null;
	}
}
