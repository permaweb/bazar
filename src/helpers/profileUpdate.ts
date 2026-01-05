import { message } from '@permaweb/aoconnect';
import { createAoSignerForChain, createUnifiedDataItemSigner } from './dataItemSigner';
import { getAOConfig } from './config';
import { checkValidAddress, getBase64Data, getDataURLContentType } from './utils';

interface UpdateProfileArgs {
	profileId: string;
	walletAddress: string;
	walletType: 'arweave' | 'evm';
	metadata: {
		DisplayName?: string;
		Username?: string;
		Description?: string;
		Thumbnail?: string;
		Banner?: string;
	};
}

interface UpdateProfileResult {
	success: boolean;
	messageId?: string;
	error?: string;
}

/**
 * Uploads an image to Arweave and returns the transaction ID
 * Similar to permaweb-libs resolveTransaction, but works with EVM wallets
 */
async function uploadImageToArweave(imageData: string, walletType: 'arweave' | 'evm'): Promise<string> {
	// If it's already a transaction ID, return it
	if (checkValidAddress(imageData)) {
		return imageData;
	}

	// If it's not a data URL, throw an error
	if (!imageData.startsWith('data:')) {
		throw new Error('Image data must be a data URL or transaction ID');
	}

	// Extract content type and base64 data
	const contentType = getDataURLContentType(imageData);
	const base64Data = getBase64Data(imageData);
	const imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

	// Create a DataItem with the image data
	const dataItemSigner = createUnifiedDataItemSigner(walletType);
	const dataItem = await dataItemSigner({
		data: imageBytes,
		tags: [
			{ name: 'Content-Type', value: contentType || 'image/jpeg' },
			{ name: 'App-Name', value: 'BazAR' },
		],
	});

	// Upload to Arweave gateway using the MU uploader endpoint
	// The MU server has an uploader that can upload DataItems to Arweave
	const MU_URL = 'https://mu.ao-testnet.xyz';
	const uploadResponse = await fetch(`${MU_URL}/tx/arweave`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/octet-stream',
			Accept: 'application/json',
		},
		body: new Uint8Array(dataItem.raw) as any, // Type assertion for fetch body
	});

	if (!uploadResponse.ok) {
		const errorText = await uploadResponse.text();
		throw new Error(`Failed to upload image to Arweave: ${uploadResponse.status} ${errorText}`);
	}

	const uploadResult = await uploadResponse.json();
	return uploadResult.id;
}

/**
 * Updates profile metadata for both Arweave and EVM wallets
 */
export async function updateProfileMetadata(args: UpdateProfileArgs): Promise<UpdateProfileResult> {
	try {
		// #region agent log
		fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				location: 'profileUpdate.ts:27',
				message: 'updateProfileMetadata entry',
				data: {
					profileId: args.profileId,
					walletType: args.walletType,
					hasThumbnail: !!args.metadata.Thumbnail,
					hasBanner: !!args.metadata.Banner,
					thumbnailLength: args.metadata.Thumbnail?.length || 0,
					bannerLength: args.metadata.Banner?.length || 0,
					thumbnailIsDataUrl: args.metadata.Thumbnail?.startsWith('data:') || false,
					bannerIsDataUrl: args.metadata.Banner?.startsWith('data:') || false,
				},
				timestamp: Date.now(),
				sessionId: 'debug-session',
				runId: 'run1',
				hypothesisId: 'A',
			}),
		}).catch(() => {});
		// #endregion

		// Upload images to Arweave first (if they are data URLs)
		// This matches permaweb-libs behavior: resolveTransaction before updating profile
		let thumbnailTxId: string | null = null;
		let bannerTxId: string | null = null;

		if (args.metadata.Thumbnail) {
			if (checkValidAddress(args.metadata.Thumbnail)) {
				// Already a transaction ID
				thumbnailTxId = args.metadata.Thumbnail;
			} else if (args.metadata.Thumbnail.startsWith('data:')) {
				// Upload to Arweave
				// #region agent log
				fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						location: 'profileUpdate.ts:80',
						message: 'Uploading thumbnail to Arweave',
						data: { thumbnailLength: args.metadata.Thumbnail.length },
						timestamp: Date.now(),
						sessionId: 'debug-session',
						runId: 'run1',
						hypothesisId: 'A1',
					}),
				}).catch(() => {});
				// #endregion
				thumbnailTxId = await uploadImageToArweave(args.metadata.Thumbnail, args.walletType);
				// #region agent log
				fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						location: 'profileUpdate.ts:90',
						message: 'Thumbnail uploaded to Arweave',
						data: { thumbnailTxId },
						timestamp: Date.now(),
						sessionId: 'debug-session',
						runId: 'run1',
						hypothesisId: 'A1',
					}),
				}).catch(() => {});
				// #endregion
			}
		}

		if (args.metadata.Banner) {
			if (checkValidAddress(args.metadata.Banner)) {
				// Already a transaction ID
				bannerTxId = args.metadata.Banner;
			} else if (args.metadata.Banner.startsWith('data:')) {
				// Upload to Arweave
				// #region agent log
				fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						location: 'profileUpdate.ts:105',
						message: 'Uploading banner to Arweave',
						data: { bannerLength: args.metadata.Banner.length },
						timestamp: Date.now(),
						sessionId: 'debug-session',
						runId: 'run1',
						hypothesisId: 'A2',
					}),
				}).catch(() => {});
				// #endregion
				bannerTxId = await uploadImageToArweave(args.metadata.Banner, args.walletType);
				// #region agent log
				fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						location: 'profileUpdate.ts:115',
						message: 'Banner uploaded to Arweave',
						data: { bannerTxId },
						timestamp: Date.now(),
						sessionId: 'debug-session',
						runId: 'run1',
						hypothesisId: 'A2',
					}),
				}).catch(() => {});
				// #endregion
			}
		}

		// Build the data array in the format expected by Zone-Update: [{key, value}, ...]
		// This matches permaweb-libs.updateProfile format
		const dataEntries: Array<{ key: string; value: string }> = [];

		if (args.metadata.DisplayName) {
			dataEntries.push({ key: 'DisplayName', value: args.metadata.DisplayName });
		}
		if (args.metadata.Username) {
			dataEntries.push({ key: 'Username', value: args.metadata.Username });
		}
		if (args.metadata.Description) {
			dataEntries.push({ key: 'Description', value: args.metadata.Description });
		}
		// Use transaction IDs instead of data URLs
		dataEntries.push({ key: 'Thumbnail', value: thumbnailTxId || 'None' });
		dataEntries.push({ key: 'Banner', value: bannerTxId || 'None' });

		// #region agent log
		fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				location: 'profileUpdate.ts:60',
				message: 'Data entries built',
				data: {
					dataEntriesCount: dataEntries.length,
					dataEntriesKeys: dataEntries.map((e) => e.key),
					dataJsonLength: JSON.stringify(dataEntries).length,
					maxValueLength: Math.max(...dataEntries.map((e) => e.value.length)),
				},
				timestamp: Date.now(),
				sessionId: 'debug-session',
				runId: 'run1',
				hypothesisId: 'B',
			}),
		}).catch(() => {});
		// #endregion

		// Build the message tags
		const tags: Array<{ name: string; value: string }> = [
			{ name: 'Data-Protocol', value: 'ao' },
			{ name: 'Variant', value: 'ao.TN.1' },
			{ name: 'Type', value: 'Message' },
			{ name: 'Action', value: 'Zone-Update' }, // Use Zone-Update instead of Update-Profile
			{ name: 'Target', value: args.profileId },
		];

		// #region agent log
		fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				location: 'profileUpdate.ts:85',
				message: 'Tags built, before DataItem creation',
				data: {
					tagsCount: tags.length,
					tagsTotalBytes: tags.reduce((sum, t) => sum + t.name.length + t.value.length, 0),
					maxTagValueLength: Math.max(...tags.map((t) => t.value.length)),
					action: tags.find((t) => t.name === 'Action')?.value,
				},
				timestamp: Date.now(),
				sessionId: 'debug-session',
				runId: 'run1',
				hypothesisId: 'C',
			}),
		}).catch(() => {});
		// #endregion

		// Format data as JSON string (zone process expects JSON array)
		const dataJson = JSON.stringify(dataEntries);

		let messageId: string;

		if (args.walletType === 'evm') {
			// For EVM wallets, send message as DataItem directly to MU endpoint
			// (aoconnect.message doesn't work with 65-byte Ethereum public keys)
			const dataItemSigner = createUnifiedDataItemSigner('evm');
			const MU_URL = 'https://mu.ao-testnet.xyz';

			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					location: 'profileUpdate.ts:95',
					message: 'Before creating DataItem for EVM',
					data: {
						profileId: args.profileId,
						dataJsonLength: dataJson.length,
						tagsCount: tags.length,
						tagsTotalBytes: tags.reduce((sum, t) => sum + t.name.length + t.value.length, 0),
					},
					timestamp: Date.now(),
					sessionId: 'debug-session',
					runId: 'run1',
					hypothesisId: 'D',
				}),
			}).catch(() => {});
			// #endregion

			const dataItem = await dataItemSigner({
				data: dataJson, // Use dataJson (Zone-Update format) instead of metadataJson
				tags: tags,
				target: args.profileId, // Explicitly set target for the DataItem
			});

			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					location: 'profileUpdate.ts:120',
					message: 'DataItem created successfully',
					data: { dataItemId: dataItem.id, rawLength: dataItem.raw.length, muUrl: MU_URL, profileId: args.profileId },
					timestamp: Date.now(),
					sessionId: 'debug-session',
					runId: 'run1',
					hypothesisId: 'E',
				}),
			}).catch(() => {});
			// #endregion

			const muResponse = await fetch(MU_URL, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/octet-stream',
					Accept: 'application/json',
				},
				body: new Uint8Array(dataItem.raw) as any, // Type assertion for fetch body
			});

			// Read response once
			const responseText = await muResponse.text();

			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					location: 'profileUpdate.ts:145',
					message: 'MU response received',
					data: {
						status: muResponse.status,
						statusText: muResponse.statusText,
						responseText: responseText.substring(0, 200),
						ok: muResponse.ok,
						profileId: args.profileId,
					},
					timestamp: Date.now(),
					sessionId: 'debug-session',
					runId: 'run1',
					hypothesisId: 'F',
				}),
			}).catch(() => {});
			// #endregion

			if (!muResponse.ok) {
				// #region agent log
				fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						location: 'profileUpdate.ts:165',
						message: 'MU message failed',
						data: {
							status: muResponse.status,
							errorText: responseText,
							profileId: args.profileId,
							dataItemId: dataItem.id,
						},
						timestamp: Date.now(),
						sessionId: 'debug-session',
						runId: 'run1',
						hypothesisId: 'G',
					}),
				}).catch(() => {});
				// #endregion

				// If the process is not found, it might not be indexed yet
				// This is a common issue with newly created profiles
				if (responseText.includes('Process') && responseText.includes('not found')) {
					throw new Error(
						`Profile process not indexed yet. Please wait a few seconds and try again. (${responseText})`
					);
				}

				throw new Error(`MU message failed: ${muResponse.status} ${responseText}`);
			}

			let muResult;
			try {
				muResult = JSON.parse(responseText);
			} catch (parseError) {
				// #region agent log
				fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						location: 'profileUpdate.ts:195',
						message: 'Failed to parse MU response',
						data: { responseText, parseError },
						timestamp: Date.now(),
						sessionId: 'debug-session',
						runId: 'run1',
						hypothesisId: 'H',
					}),
				}).catch(() => {});
				// #endregion
				// If parsing fails, use dataItem.id as fallback
				muResult = { id: dataItem.id };
			}

			messageId = muResult.id || dataItem.id;

			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					location: 'profileUpdate.ts:210',
					message: 'MU message success',
					data: { messageId, profileId: args.profileId },
					timestamp: Date.now(),
					sessionId: 'debug-session',
					runId: 'run1',
					hypothesisId: 'I',
				}),
			}).catch(() => {});
			// #endregion
		} else {
			// For Arweave wallets, use aoconnect.message
			const signer = createAoSignerForChain(args.walletType);
			messageId = await message({
				process: args.profileId,
				signer: signer,
				tags: tags,
				data: dataJson, // Include the data in the message
			});
		}

		// Wait for message to be processed
		await new Promise((resolve) => setTimeout(resolve, 2000));

		// For EVM wallets, verify the update by querying the profile state
		if (args.walletType === 'evm') {
			try {
				const aoConfig = getAOConfig();
				const CU_URL = aoConfig.cu_url || 'https://cu.ao-testnet.xyz';

				// Query the profile state to verify the update
				const queryResponse = await fetch(`${CU_URL}/${args.profileId}`, {
					method: 'GET',
					headers: { Accept: 'application/json' },
				});

				if (queryResponse.ok) {
					const profileState = await queryResponse.json();

					// #region agent log
					fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							location: 'profileUpdate.ts:310',
							message: 'Profile state queried after update',
							data: {
								profileId: args.profileId,
								hasOwner: !!profileState?.Owner,
								owner: profileState?.Owner,
								hasStore: !!profileState?.Store,
								storeKeys: profileState?.Store ? Object.keys(profileState.Store) : [],
								thumbnail: profileState?.Store?.Thumbnail?.substring(0, 50) || null,
								displayName: profileState?.Store?.DisplayName || null,
							},
							timestamp: Date.now(),
							sessionId: 'debug-session',
							runId: 'run1',
							hypothesisId: 'J',
						}),
					}).catch(() => {});
					// #endregion
				}
			} catch (verifyError) {
				// Verification failed, but don't fail the update - it might still have worked
				console.warn('Failed to verify profile update:', verifyError);
			}
		}

		return {
			success: true,
			messageId: messageId,
		};
	} catch (error) {
		console.error('Error updating profile:', error);
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error',
		};
	}
}
