import { message } from '@permaweb/aoconnect';
import { createAoSignerForChain, createUnifiedDataItemSigner } from './dataItemSigner';
import { getAOConfig } from './config';

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
 * Updates profile metadata for both Arweave and EVM wallets
 */
export async function updateProfileMetadata(args: UpdateProfileArgs): Promise<UpdateProfileResult> {
	try {
		// Build the metadata tags
		const tags: Array<{ name: string; value: string }> = [
			{ name: 'Data-Protocol', value: 'ao' },
			{ name: 'Variant', value: 'ao.TN.1' },
			{ name: 'Type', value: 'Message' },
			{ name: 'Action', value: 'Update-Profile' },
			{ name: 'Target', value: args.profileId },
		];

		// Add metadata as tags
		if (args.metadata.DisplayName) {
			tags.push({ name: 'DisplayName', value: args.metadata.DisplayName });
		}
		if (args.metadata.Username) {
			tags.push({ name: 'UserName', value: args.metadata.Username });
		}
		if (args.metadata.Description) {
			tags.push({ name: 'Description', value: args.metadata.Description });
		}
		if (args.metadata.Thumbnail) {
			tags.push({ name: 'Thumbnail', value: args.metadata.Thumbnail });
		}
		if (args.metadata.Banner) {
			tags.push({ name: 'Banner', value: args.metadata.Banner });
		}

		let messageId: string;

		if (args.walletType === 'evm') {
			// For EVM wallets, send message as DataItem directly to MU endpoint
			// (aoconnect.message doesn't work with 65-byte Ethereum public keys)
			const dataItemSigner = createUnifiedDataItemSigner('evm');
			const aoConfig = getAOConfig();
			const MU_URL = aoConfig.mu_url || 'https://mu.ao-testnet.xyz';

			// Create DataItem with metadata as JSON in data field (same format as profile creation)
			const metadataJson = JSON.stringify({
				DisplayName: args.metadata.DisplayName,
				Username: args.metadata.Username,
				Description: args.metadata.Description,
				Thumbnail: args.metadata.Thumbnail,
				Banner: args.metadata.Banner,
			});

			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					location: 'profileUpdate.ts:60',
					message: 'Creating DataItem for EVM profile update',
					data: {
						profileId: args.profileId,
						metadataJson,
						metadataKeys: Object.keys({
							DisplayName: args.metadata.DisplayName,
							Username: args.metadata.Username,
							Description: args.metadata.Description,
							Thumbnail: args.metadata.Thumbnail,
							Banner: args.metadata.Banner,
						}),
					},
					timestamp: Date.now(),
					sessionId: 'debug-session',
					runId: 'run2',
					hypothesisId: 'L',
				}),
			}).catch(() => {});
			// #endregion

			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					location: 'profileUpdate.ts:77',
					message: 'Before creating DataItem',
					data: {
						profileId: args.profileId,
						hasTargetTag: tags.some((t) => t.name === 'Target'),
						targetTagValue: tags.find((t) => t.name === 'Target')?.value,
					},
					timestamp: Date.now(),
					sessionId: 'debug-session',
					runId: 'run2',
					hypothesisId: 'Q',
				}),
			}).catch(() => {});
			// #endregion

			const dataItem = await dataItemSigner({
				data: metadataJson,
				tags: tags,
				target: args.profileId, // Explicitly set target for the DataItem
			});

			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					location: 'profileUpdate.ts:75',
					message: 'DataItem created, sending to MU',
					data: { dataItemId: dataItem.id, rawLength: dataItem.raw.length, muUrl: MU_URL, profileId: args.profileId },
					timestamp: Date.now(),
					sessionId: 'debug-session',
					runId: 'run2',
					hypothesisId: 'L',
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

			// Read response once
			const responseText = await muResponse.text();

			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					location: 'profileUpdate.ts:90',
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
					runId: 'run2',
					hypothesisId: 'L',
				}),
			}).catch(() => {});
			// #endregion

			if (!muResponse.ok) {
				// #region agent log
				fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						location: 'profileUpdate.ts:102',
						message: 'MU message failed',
						data: {
							status: muResponse.status,
							errorText: responseText,
							profileId: args.profileId,
							dataItemId: dataItem.id,
						},
						timestamp: Date.now(),
						sessionId: 'debug-session',
						runId: 'run2',
						hypothesisId: 'L',
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
						location: 'profileUpdate.ts:103',
						message: 'Failed to parse MU response',
						data: { responseText, parseError },
						timestamp: Date.now(),
						sessionId: 'debug-session',
						runId: 'run2',
						hypothesisId: 'L',
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
					location: 'profileUpdate.ts:103',
					message: 'MU message success',
					data: { messageId, profileId: args.profileId },
					timestamp: Date.now(),
					sessionId: 'debug-session',
					runId: 'run2',
					hypothesisId: 'L',
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
			});
		}

		// Wait for message to be processed
		await new Promise((resolve) => setTimeout(resolve, 2000));

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
