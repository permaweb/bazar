import { messageResult, readHandler } from 'api';

import { AO, DELEGATION } from 'helpers/config';
import { calculateDelegationLimits, getDelegations } from 'helpers/delegationUtils';
import {
	calculateTierRewards,
	getTierQuestDescription,
	getWanderTierInfo,
	getWanderTierInfoInjected,
	requestTierAdvancement,
} from 'helpers/wanderTier';
import { completeQuest, updateQuestProgress } from 'store/quests';
import { QuestProgress } from 'store/quests/types';

export class QuestTracker {
	private static instance: QuestTracker;
	private dispatch: any;
	private errorThrottleMap: Map<string, number> = new Map();
	private progressCache: Map<string, { data: QuestProgress; timestamp: number }> = new Map();
	private CACHE_DURATION = 30000; // 30 second cache (reduced for testing)

	private constructor() {}

	/**
	 * Throttle error logging to prevent spam
	 */
	private shouldLogError(errorKey: string, intervalMs: number = 30000): boolean {
		const now = Date.now();
		const lastLogged = this.errorThrottleMap.get(errorKey) || 0;
		if (now - lastLogged > intervalMs) {
			this.errorThrottleMap.set(errorKey, now);
			return true;
		}
		return false;
	}

	/**
	 * Clear progress cache (for debugging)
	 */
	public clearCache(): void {
		this.progressCache.clear();
		console.log('QuestTracker - Cache cleared');
	}

	public static getInstance(): QuestTracker {
		if (!QuestTracker.instance) {
			QuestTracker.instance = new QuestTracker();
		}
		return QuestTracker.instance;
	}

	public setDispatch(dispatch: any) {
		this.dispatch = dispatch;
	}

	/**
	 * Track profile creation
	 */
	public async trackProfileCreation(profileId: string) {
		if (!this.dispatch) return;

		const progress: Partial<QuestProgress> = {
			profileCreated: true,
		};

		this.dispatch(updateQuestProgress(progress));
		this.checkQuestCompletion('create-profile');
	}

	/**
	 * Track asset creation
	 */
	public async trackAssetCreation(assetId: string, profileId: string) {
		if (!this.dispatch) return;

		try {
			// Get current profile assets
			const profile = await readHandler({
				processId: profileId,
				action: 'Info',
				data: null,
			});

			if (profile && profile.Assets) {
				const assetIds = profile.Assets.filter((asset: any) => asset.Id !== 'wAR' && asset.Id !== 'PIXL').map(
					(asset: any) => asset.Id
				);

				const progress: Partial<QuestProgress> = {
					totalAssets: assetIds.length,
					firstAssetCreated: assetIds.length > 0,
				};

				this.dispatch(updateQuestProgress(progress));
				this.checkQuestCompletion('create-asset');
			}
		} catch (error) {
			console.error('Error tracking asset creation:', error);
		}
	}

	/**
	 * Track collection creation
	 */
	public async trackCollectionCreation(collectionId: string, profileId: string) {
		if (!this.dispatch) return;

		try {
			// This would need to be implemented based on your collection system
			// For now, we'll simulate collection tracking
			const progress: Partial<QuestProgress> = {
				totalCollections: 1, // This should be calculated from actual collections
				firstCollectionCreated: true,
			};

			this.dispatch(updateQuestProgress(progress));
			this.checkQuestCompletion('create-collection');
		} catch (error) {
			console.error('Error tracking collection creation:', error);
		}
	}

	/**
	 * Track purchase completion
	 */
	public async trackPurchase(assetId: string, buyerProfileId: string, quantity: string) {
		if (!this.dispatch) return;

		try {
			// Update purchase tracking
			const progress: Partial<QuestProgress> = {
				totalPurchases: 1, // This should be incremented from current value
				firstPurchaseMade: true,
			};

			this.dispatch(updateQuestProgress(progress));
			this.checkQuestCompletion('make-purchase');

			// Also track PIXL streak calculation (existing functionality)
			if (AO.pixl) {
				try {
					// Skip PIXL streak calculation for now - requires wallet
					console.log('PIXL streak calculation skipped - wallet not available in tracker');
				} catch (error) {
					console.error('Error calculating PIXL streak:', error);
				}
			}
		} catch (error) {
			console.error('Error tracking purchase:', error);
		}
	}

	/**
	 * Track PIXL delegation
	 */
	public async trackPixelDelegation(walletAddress: string) {
		if (!this.dispatch) return;

		try {
			// Check if delegation functions are available
			if (typeof getDelegations !== 'function' || typeof calculateDelegationLimits !== 'function') {
				console.log('Delegation utilities not available');
				return;
			}

			const delegations = await getDelegations(walletAddress);
			const limits = calculateDelegationLimits(delegations, DELEGATION.PIXL_PROCESS, walletAddress);

			// Check if user has delegated at least 10% to PIXL
			const hasSufficientDelegation = limits.currentPixlDelegation >= 10;

			const progress: Partial<QuestProgress> = {
				pixelDelegated: hasSufficientDelegation,
				pixelDelegationPercentage: limits.currentPixlDelegation,
			};

			this.dispatch(updateQuestProgress(progress));

			if (hasSufficientDelegation) {
				this.checkQuestCompletion('delegate-pixl');
			}
		} catch (error) {
			console.log('Delegation tracking unavailable:', error);
			// Set safe defaults
			const progress: Partial<QuestProgress> = {
				pixelDelegated: false,
				pixelDelegationPercentage: 0,
			};
			this.dispatch(updateQuestProgress(progress));
		}
	}

	/**
	 * Check if a quest is completed and dispatch completion action
	 */
	private checkQuestCompletion(questId: string) {
		if (!this.dispatch) return;

		// Get current quest state from store
		// This is a simplified check - in a real implementation, you'd get the current state
		const questProgressMap: { [key: string]: () => boolean } = {
			'create-profile': () => true, // If this function is called, profile is created
			'create-asset': () => true, // If this function is called, asset is created
			'create-collection': () => true, // If this function is called, collection is created
			'make-purchase': () => true, // If this function is called, purchase is made
			'delegate-pixl': () => true, // If this function is called, PIXL is delegated
		};

		if (questProgressMap[questId] && questProgressMap[questId]()) {
			this.dispatch(completeQuest(questId));
		}
	}

	/**
	 * Get comprehensive quest progress for a user
	 */
	public async getQuestProgress(profileId: string, walletAddress?: string): Promise<Partial<QuestProgress>> {
		try {
			// Check cache first
			const cacheKey = `${profileId}-${walletAddress || 'no-wallet'}`;
			const cached = this.progressCache.get(cacheKey);
			const now = Date.now();

			if (cached && now - cached.timestamp < this.CACHE_DURATION) {
				console.log('QuestTracker - Using cached progress for:', cacheKey);
				return cached.data;
			}

			console.log('QuestTracker - Getting fresh progress for:', { profileId, walletAddress });

			// If we have a profileId, that means profile exists
			const hasProfile = profileId && profileId.length === 43;

			let profile = null;
			let assetIds: string[] = [];

			if (hasProfile) {
				try {
					console.log('QuestTracker - Starting asset detection process...');
					console.log('QuestTracker - Has wallet address:', !!walletAddress);
					console.log('QuestTracker - Profile ID:', profileId);

					// Try to use permaweb-libs for better profile structure - fetch by wallet address to get zone profile
					try {
						console.log('QuestTracker - Attempting permaweb-libs import...');
						const PermawebLibs = (await import('@permaweb/libs')).default;
						console.log('QuestTracker - Permaweb-libs imported successfully');

						if (walletAddress) {
							console.log('QuestTracker - Initializing permaweb-libs with deps...');
							// We need to initialize with deps similar to PermawebProvider
							const { connect, createSigner } = await import('@permaweb/aoconnect');
							const Arweave = (await import('arweave')).default;
							const deps = {
								ao: connect({ MODE: 'legacy' }),
								arweave: Arweave.init({}),
								signer: null, // We don't need signer for reading
							};
							const libs = PermawebLibs.init(deps);
							console.log('QuestTracker - Fetching zone profile for wallet:', walletAddress);
							const permawebProfile = await libs.getProfileByWalletAddress(walletAddress);
							console.log('QuestTracker - Zone profile fetched:', !!permawebProfile);
							console.log('QuestTracker - Zone profile structure:', {
								hasAssets: !!permawebProfile?.assets,
								assetsType: Array.isArray(permawebProfile?.assets) ? 'array' : typeof permawebProfile?.assets,
								assetsLength: permawebProfile?.assets?.length,
								hasCollections: !!permawebProfile?.collections,
								collectionsLength: permawebProfile?.collections?.length,
							});

							if (permawebProfile && permawebProfile.assets) {
								// Use permaweb-libs profile format - this should have all created assets
								console.log('QuestTracker - Processing zone profile assets...');
								console.log('QuestTracker - Raw assets:', permawebProfile.assets.slice(0, 3)); // Log first 3 for inspection
								assetIds = permawebProfile.assets.map((asset: any) => asset.id).filter(Boolean);
								console.log(
									`QuestTracker - ✅ Found ${assetIds.length} created assets from zone profile (permaweb-libs)`
								);
								console.log('QuestTracker - Sample asset IDs:', assetIds.slice(0, 5));
							} else {
								console.log('QuestTracker - ❌ Zone profile missing assets field');
							}
						} else {
							console.log('QuestTracker - ❌ No wallet address provided for zone profile fetch');
						}
					} catch (permawebError) {
						console.log('QuestTracker - ❌ Permaweb libs failed:', permawebError.message || permawebError);
					}

					// Fallback to raw profile read if permaweb-libs failed
					if (assetIds.length === 0) {
						console.log('QuestTracker - 🔄 Falling back to raw profile read...');
						profile = await readHandler({
							processId: profileId,
							action: 'Info',
							data: null,
						});

						console.log('QuestTracker - Raw profile data received:', !!profile);
						console.log('QuestTracker - Profile structure keys:', profile ? Object.keys(profile) : 'none');
						console.log('QuestTracker - Profile Assets (owned):', profile?.Assets?.length);
						console.log('QuestTracker - Profile assets (created lowercase):', profile?.assets?.length);
						console.log('QuestTracker - Profile collections (created lowercase):', profile?.collections?.length);
						console.log('QuestTracker - Profile Collections (capital C):', profile?.Collections?.length);

						// For quest tracking, we need to count CREATED assets, not just owned assets
						if (profile) {
							console.log('QuestTracker - 🔍 Trying different asset detection methods...');
							console.log('QuestTracker - Profile structure overview:', {
								hasAssets: !!profile.assets,
								hasNestedAssets: !!profile.Profile?.assets,
								hasOwnedAssets: !!profile.Assets,
								assetsLength: profile.assets?.length,
								nestedAssetsLength: profile.Profile?.assets?.length,
								ownedAssetsLength: profile.Assets?.length,
							});

							// Method 1: Check profile.assets (lowercase)
							if (profile.assets && Array.isArray(profile.assets)) {
								console.log(
									'QuestTracker - Method 1: Found profile.assets (lowercase), length:',
									profile.assets.length
								);
								console.log('QuestTracker - Sample assets:', profile.assets.slice(0, 3));
								if (profile.assets.length > 0 && typeof profile.assets[0] === 'object') {
									// New profile format: assets is array of objects
									assetIds = profile.assets.map((asset: any) => asset.id || asset.Id).filter(Boolean);
									console.log('QuestTracker - ✅ Method 1a: Object format, extracted IDs:', assetIds.length);
									console.log('QuestTracker - Sample extracted IDs:', assetIds.slice(0, 3));
								} else {
									// Legacy profile format: assets is array of IDs
									assetIds = profile.assets.filter(Boolean);
									console.log('QuestTracker - ✅ Method 1b: ID array format, filtered IDs:', assetIds.length);
									console.log('QuestTracker - Sample IDs:', assetIds.slice(0, 3));
								}
							}
							// Method 2: Check nested Profile.assets
							else if (profile.Profile && profile.Profile.assets) {
								console.log(
									'QuestTracker - Method 2: Found profile.Profile.assets, length:',
									profile.Profile.assets.length
								);
								console.log('QuestTracker - Sample nested assets:', profile.Profile.assets.slice(0, 3));
								assetIds = profile.Profile.assets.map((asset: any) => asset.id || asset.Id || asset).filter(Boolean);
								console.log('QuestTracker - ✅ Method 2: Nested format, extracted IDs:', assetIds.length);
								console.log('QuestTracker - Sample extracted IDs:', assetIds.slice(0, 3));
							}
							// Method 3: Filter owned Assets as proxy for created assets
							else if (profile.Assets && profile.Assets.length > 0) {
								console.log(
									'QuestTracker - Method 3: Using owned Assets as proxy, total owned:',
									profile.Assets.length
								);
								console.log('QuestTracker - Sample owned assets:', profile.Assets.slice(0, 3));
								// As a last resort, assume all owned assets are created (this may include false positives)
								// Filter out obvious tokens like wAR, PIXL, etc.
								const createdAssets = profile.Assets.filter((asset: any) => {
									const assetId = asset.Id || asset.id;
									const assetBalance = asset.Balance || asset.balance || asset.Quantity || asset.quantity;

									// Must have valid asset ID
									if (!assetId || assetId.length !== 43) return false;

									// Exclude common base tokens
									if (assetId === 'wAR' || assetId === 'PIXL' || assetId === 'TRUNK' || assetId === 'WNDR') {
										return false;
									}

									// Include assets with positive balance OR no balance field (assume owned)
									if (assetBalance) {
										return parseInt(assetBalance.toString()) > 0 || parseFloat(assetBalance.toString()) > 0;
									}

									// If no balance field, assume it's owned/created
									return true;
								});
								assetIds = createdAssets.map((asset: any) => asset.Id || asset.id);
								console.log(
									`QuestTracker - ✅ Method 3: Filtered owned assets as proxy for created assets: ${assetIds.length}`
								);
								console.log('QuestTracker - Sample filtered asset IDs:', assetIds.slice(0, 5));
							} else {
								console.log('QuestTracker - ❌ No asset fields found in profile');
							}

							console.log(`QuestTracker - 🎯 Final result: Found ${assetIds.length} created assets`);
							console.log('QuestTracker - Asset detection summary:', {
								totalFound: assetIds.length,
								firstAssetCreated: assetIds.length > 0,
								sampleIds: assetIds.slice(0, 3),
							});
						} else {
							console.log('QuestTracker - ❌ No profile data received');
						}
					} else {
						console.log('QuestTracker - ✅ Using zone profile assets, skipping fallback');
					}
				} catch (error) {
					console.log('QuestTracker - Profile read failed, but profileId exists:', error);
					// Profile exists (we have ID) but read failed - still count as having profile
				}
			}

			console.log('QuestTracker - 📊 Calculating final quest progress...');
			console.log('QuestTracker - Input data:', {
				hasProfile,
				profileId,
				walletAddress,
				assetIdsLength: assetIds.length,
				firstAssetCreated: assetIds.length > 0,
			});

			const collectionsCount = hasProfile ? await this.getCollectionCount(profileId, walletAddress) : 0;
			const hasCreatedCollections = hasProfile ? await this.hasCreatedCollection(profileId, walletAddress) : false;

			console.log('QuestTracker - Collection calculation results:', {
				collectionsCount,
				hasCreatedCollections,
			});

			const progress: Partial<QuestProgress> = {
				profileCreated: hasProfile, // If we have profileId, profile exists
				totalAssets: assetIds.length,
				firstAssetCreated: assetIds.length > 0,
				totalCollections: collectionsCount,
				firstCollectionCreated: hasCreatedCollections,
				totalPurchases: hasProfile ? await this.getPurchaseCount(profileId) : 0,
				firstPurchaseMade: hasProfile ? await this.hasMadePurchase(profileId) : false,
				pixelDelegated: await this.hasPixelDelegation(walletAddress),
				hasStampedAsset: await this.hasStampedAsset(walletAddress),
				hasStampedSilverDumDum: await this.hasStampedSilverDumDum(walletAddress),
			};

			console.log('QuestTracker - 🎯 FINAL CALCULATED PROGRESS:', progress);
			console.log('QuestTracker - Key quest completions:', {
				'✅ Profile Created': progress.profileCreated,
				'✅ First Asset Created': progress.firstAssetCreated,
				'✅ First Collection Created': progress.firstCollectionCreated,
				'✅ PIXL Delegated': progress.pixelDelegated,
				'Assets Count': progress.totalAssets,
				'Collections Count': progress.totalCollections,
			});

			// Get Wander tier information if wallet address is provided
			if (walletAddress) {
				try {
					// Try injected API first, then fallback to dryrun
					let tierInfo = await getWanderTierInfoInjected();
					if (!tierInfo) {
						tierInfo = await getWanderTierInfo(walletAddress);
					}

					if (tierInfo) {
						progress.wanderTier = tierInfo.tier;
						progress.wanderBalance = tierInfo.balance;
						progress.wanderRank = tierInfo.rank;
					}
				} catch (error) {
					console.error('Error fetching Wander tier info:', error);
				}
			}

			// Cache the result
			this.progressCache.set(cacheKey, { data: progress as QuestProgress, timestamp: now });

			return progress;
		} catch (error) {
			if (this.shouldLogError('quest-progress-error')) {
				console.warn('Error getting quest progress:', error.message || error);
			}
			return {};
		}
	}

	/**
	 * Initialize quest tracking for a user
	 */
	public async initializeQuestTracking(profileId: string) {
		if (!this.dispatch) return;

		const progress = await this.getQuestProgress(profileId);
		this.dispatch(updateQuestProgress(progress));
	}

	/**
	 * Check if user has created any collections
	 */
	private async hasCreatedCollection(profileId: string, walletAddress?: string): Promise<boolean> {
		try {
			// Try to use permaweb-libs first for collections - fetch by wallet address to get zone profile
			try {
				const PermawebLibs = (await import('@permaweb/libs')).default;
				if (walletAddress) {
					// We need to initialize with deps similar to PermawebProvider
					const { connect, createSigner } = await import('@permaweb/aoconnect');
					const Arweave = (await import('arweave')).default;
					const deps = {
						ao: connect({ MODE: 'legacy' }),
						arweave: Arweave.init({}),
						signer: null, // We don't need signer for reading
					};
					const libs = PermawebLibs.init(deps);
					const permawebProfile = await libs.getProfileByWalletAddress(walletAddress);
					if (permawebProfile && permawebProfile.collections && permawebProfile.collections.length > 0) {
						console.log(
							'QuestTracker - Collections from zone profile (permaweb-libs):',
							permawebProfile.collections.length
						);
						return true;
					}
				}
			} catch (permawebError) {
				// Continue to other methods
			}

			// First try the collections API
			try {
				const { getCollections } = await import('api/collections');
				const collections = await getCollections(profileId, null);
				console.log('QuestTracker - Collections from API:', collections);
				if (collections && collections.length > 0) {
					return true;
				}
			} catch (importError) {
				if (this.shouldLogError('collections-api-profile')) {
					console.warn('Collections API not available, checking profile directly');
				}
			}

			// Fallback: Check profile for collection-related data
			const profile = await readHandler({
				processId: profileId,
				action: 'Info',
				data: null,
			});

			if (profile) {
				// First check direct collections field
				if (profile.collections && Array.isArray(profile.collections) && profile.collections.length > 0) {
					console.log('QuestTracker - Collections from profile.collections:', profile.collections.length);
					return true;
				}

				// Check nested Profile structure
				if (
					profile.Profile &&
					profile.Profile.collections &&
					Array.isArray(profile.Profile.collections) &&
					profile.Profile.collections.length > 0
				) {
					console.log(
						'QuestTracker - Collections from profile.Profile.collections:',
						profile.Profile.collections.length
					);
					return true;
				}

				// Check Collections field (capital C) - this appears to be the correct field
				if (profile.Collections && Array.isArray(profile.Collections) && profile.Collections.length > 0) {
					console.log('QuestTracker - Collections from profile.Collections:', profile.Collections.length);
					return true;
				}

				// Fallback: Check if any assets are marked as collections
				if (profile.Assets) {
					const collections = profile.Assets.filter(
						(asset: any) =>
							asset.Collection ||
							asset.Type === 'Collection' ||
							(asset.Tags && asset.Tags.find((tag: any) => tag.name === 'Type' && tag.value === 'Collection'))
					);
					console.log('QuestTracker - Collections from profile.Assets:', collections.length);
					return collections.length > 0;
				}
			}
			return false;
		} catch (error) {
			if (this.shouldLogError('collection-creation-error')) {
				console.warn('Error checking collection creation:', error.message || error);
			}
			return false;
		}
	}

	/**
	 * Get count of collections created by user
	 */
	private async getCollectionCount(profileId: string, walletAddress?: string): Promise<number> {
		try {
			// Try to use permaweb-libs first
			try {
				const PermawebLibs = (await import('@permaweb/libs')).default;
				if (walletAddress) {
					const { connect } = await import('@permaweb/aoconnect');
					const Arweave = (await import('arweave')).default;
					const deps = {
						ao: connect({ MODE: 'legacy' }),
						arweave: Arweave.init({}),
						signer: null,
					};
					const libs = PermawebLibs.init(deps);
					const permawebProfile = await libs.getProfileByWalletAddress(walletAddress);
					if (permawebProfile && permawebProfile.collections) {
						console.log(
							'QuestTracker - Collection count from zone profile (permaweb-libs):',
							permawebProfile.collections.length
						);
						return permawebProfile.collections.length;
					}
				}
			} catch (permawebError) {
				// Continue to other methods
			}

			// Try to use the collections API
			try {
				const { getCollections } = await import('api/collections');
				const collections = await getCollections(profileId, null);
				return collections ? collections.length : 0;
			} catch (importError) {
				if (this.shouldLogError('collections-api-fallback')) {
					console.warn('Collections API not available, using fallback method');
				}
				// Try direct profile access for collection count
				try {
					const profile = await readHandler({
						processId: profileId,
						action: 'Info',
						data: null,
					});

					if (profile) {
						// Check Collections field (capital C) first
						if (profile.Collections && Array.isArray(profile.Collections)) {
							console.log('QuestTracker - Collection count from profile.Collections:', profile.Collections.length);
							return profile.Collections.length;
						}

						// Check other collection fields
						if (profile.collections && Array.isArray(profile.collections)) {
							console.log('QuestTracker - Collection count from profile.collections:', profile.collections.length);
							return profile.collections.length;
						}

						if (profile.Profile && profile.Profile.collections && Array.isArray(profile.Profile.collections)) {
							console.log(
								'QuestTracker - Collection count from profile.Profile.collections:',
								profile.Profile.collections.length
							);
							return profile.Profile.collections.length;
						}
					}
				} catch (profileError) {
					console.log('QuestTracker - Error reading profile for collection count:', profileError);
				}

				// Final fallback to boolean check
				const hasCollection = await this.hasCreatedCollection(profileId, walletAddress);
				return hasCollection ? 1 : 0;
			}
		} catch (error) {
			console.error('Error getting collection count:', error);
			return 0;
		}
	}

	/**
	 * Check if user has made any purchases
	 */
	private async hasMadePurchase(profileId: string): Promise<boolean> {
		try {
			console.log('QuestTracker - 🛒 Checking purchase history for profile:', profileId);

			// Check profile assets for evidence of purchases
			const profile = await readHandler({
				processId: profileId,
				action: 'Info',
				data: null,
			});

			console.log('QuestTracker - Purchase detection - Profile data received:', !!profile);
			console.log('QuestTracker - Purchase detection - Assets available:', !!profile?.Assets);
			console.log('QuestTracker - Purchase detection - Total assets:', profile?.Assets?.length || 0);

			if (profile && profile.Assets) {
				// Log all assets for debugging (first 5 only to avoid spam)
				console.log('QuestTracker - 🔍 Sample assets in profile (first 5):');
				profile.Assets.slice(0, 5).forEach((asset: any, index: number) => {
					console.log(`QuestTracker - Asset ${index + 1}:`, {
						Id: asset.Id,
						id: asset.id,
						Balance: asset.Balance,
						balance: asset.balance,
						Quantity: asset.Quantity,
						quantity: asset.quantity,
						allKeys: Object.keys(asset),
						isBaseToken: asset.Id === 'wAR' || asset.Id === 'PIXL',
					});
				});

				// Check if user has assets that suggest purchases (excluding base tokens)
				const nonBaseAssets = profile.Assets.filter((asset: any) => {
					const assetId = asset.Id || asset.id;
					const assetBalance = asset.Balance || asset.balance || asset.Quantity || asset.quantity;

					// Exclude common base tokens
					if (assetId === 'wAR' || assetId === 'PIXL' || assetId === 'TRUNK' || assetId === 'WNDR') {
						return false;
					}

					// Check if asset has positive balance (more flexible balance checking)
					if (
						assetBalance &&
						(parseInt(assetBalance.toString()) > 0 ||
							parseFloat(assetBalance.toString()) > 0 ||
							assetBalance.toString() !== '0')
					) {
						return true;
					}

					// If no balance field, assume it's owned (for newer profile formats)
					if (!assetBalance && assetId && assetId.length === 43) {
						return true;
					}

					return false;
				});

				console.log('QuestTracker - 📈 Non-base assets for purchase detection:', nonBaseAssets.length);
				console.log(
					'QuestTracker - 📈 Non-base assets details:',
					nonBaseAssets.map((asset) => ({
						id: asset.Id,
						balance: asset.Balance,
					}))
				);

				const hasPurchases = nonBaseAssets.length >= 1;
				console.log('QuestTracker - 🎯 Purchase detection result:', hasPurchases);

				// If user has assets beyond base tokens, they likely made purchases
				// This is a simple heuristic - considers any asset ownership as potential purchase
				return hasPurchases;
			}

			console.log('QuestTracker - ❌ No profile or assets found for purchase detection');
			return false;
		} catch (error) {
			if (this.shouldLogError('purchase-history-error')) {
				console.warn('QuestTracker - ❌ Error checking purchase history:', error.message || error);
			}
			return false;
		}
	}

	/**
	 * Get count of purchases made by user
	 */
	private async getPurchaseCount(profileId: string): Promise<number> {
		try {
			const hasPurchase = await this.hasMadePurchase(profileId);
			return hasPurchase ? 1 : 0; // Simplified for now
		} catch (error) {
			if (this.shouldLogError('purchase-count-error')) {
				console.warn('Error getting purchase count:', error.message || error);
			}
			return 0;
		}
	}

	/**
	 * Check if user has stamped (liked) any asset
	 */
	private async hasStampedAsset(walletAddress?: string): Promise<boolean> {
		if (!walletAddress) {
			console.log('QuestTracker - Stamping check: No wallet address provided');
			return false;
		}

		try {
			console.log('QuestTracker - 🎯 Checking if user has stamped any asset...');

			// Import stamps API to check if user has stamped anything
			const stampsAPI = await import('api/stamps');

			// This is a simplified check - in a real implementation, we'd need to
			// check the stamps registry or track stamping activity
			// For now, we'll check the Redux stamps state for any stamped assets
			const stampsReducer = (window as any).__REDUX_STORE__?.getState()?.stampsReducer;

			if (stampsReducer) {
				const hasStamped = Object.values(stampsReducer).some((stamp: any) => stamp.hasStamped === true);
				console.log('QuestTracker - Found stamped assets in Redux state:', hasStamped);
				return hasStamped;
			}

			console.log('QuestTracker - No stamps data available, assuming not stamped');
			return false;
		} catch (error) {
			console.log('QuestTracker - ❌ Stamping check failed:', error);
			return false;
		}
	}

	/**
	 * Check if user has stamped their Silver DumDum (required for Platinum DumDum)
	 */
	private async hasStampedSilverDumDum(walletAddress?: string): Promise<boolean> {
		if (!walletAddress) {
			console.log('QuestTracker - Silver DumDum stamping check: No wallet address provided');
			return false;
		}

		try {
			console.log('QuestTracker - 🥈 Checking if user has stamped their Silver DumDum...');

			// This would need to check specifically for stamping the Silver DumDum asset
			// For now, we'll use the general stamping check as a proxy
			// In a real implementation, we'd check for stamps on the specific Silver DumDum asset ID
			const stampsReducer = (window as any).__REDUX_STORE__?.getState()?.stampsReducer;

			if (stampsReducer) {
				// Look for stamps on Silver DumDum specifically
				// For now, we'll assume if they've stamped any asset, they've stamped Silver DumDum
				const hasStamped = Object.values(stampsReducer).some((stamp: any) => stamp.hasStamped === true);
				console.log('QuestTracker - Silver DumDum stamping status:', hasStamped);
				return hasStamped;
			}

			console.log('QuestTracker - No stamps data available for Silver DumDum check');
			return false;
		} catch (error) {
			console.log('QuestTracker - ❌ Silver DumDum stamping check failed:', error);
			return false;
		}
	}

	/**
	 * Check if user has delegated sufficient PIXL tokens
	 */
	private async hasPixelDelegation(walletAddress?: string): Promise<boolean> {
		if (!walletAddress) {
			console.log('QuestTracker - PIXL delegation check: No wallet address provided');
			return false;
		}

		try {
			console.log('QuestTracker - 🎯 Checking PIXL delegation for wallet:', walletAddress);

			// Check if delegation functions are available
			if (typeof getDelegations !== 'function' || typeof calculateDelegationLimits !== 'function') {
				console.log('QuestTracker - ❌ Delegation functions not available');
				return false;
			}

			console.log('QuestTracker - Fetching delegations...');
			const delegations = await getDelegations(walletAddress);
			console.log('QuestTracker - Delegations received:', delegations);

			console.log('QuestTracker - Calculating delegation limits...');
			console.log('QuestTracker - Using PIXL process:', DELEGATION.PIXL_PROCESS);
			const limits = calculateDelegationLimits(delegations, DELEGATION.PIXL_PROCESS, walletAddress);
			console.log('QuestTracker - Delegation limits:', limits);

			console.log('QuestTracker - Current PIXL delegation percentage:', limits.currentPixlDelegation);
			console.log('QuestTracker - Required delegation: 10%');

			const hasEnoughDelegation = limits.currentPixlDelegation >= 10;
			console.log('QuestTracker - 🎯 PIXL delegation result:', hasEnoughDelegation);

			// Check if user has delegated at least 10% to PIXL
			return hasEnoughDelegation;
		} catch (error) {
			console.log('QuestTracker - ❌ PIXL delegation check failed:', error);
			return false;
		}
	}

	/**
	 * Check if user has completed all Wander campaign quests
	 */
	public async hasCompletedWanderCampaign(profileId: string): Promise<boolean> {
		try {
			const progress = await this.getQuestProgress(profileId);

			// Check all required campaign tasks
			return !!(
				progress.profileCreated &&
				progress.firstAssetCreated &&
				progress.firstCollectionCreated &&
				progress.firstPurchaseMade &&
				progress.pixelDelegated
			);
		} catch (error) {
			console.error('Error checking campaign completion:', error);
			return false;
		}
	}

	/**
	 * Attempt to advance user's Wander tier upon campaign completion
	 */
	public async tryAdvanceWanderTier(profileId: string, walletAddress: string): Promise<boolean> {
		try {
			const campaignCompleted = await this.hasCompletedWanderCampaign(profileId);

			if (!campaignCompleted) {
				console.log('Campaign not completed, cannot advance tier');
				return false;
			}

			// Get current tier info
			let tierInfo = await getWanderTierInfoInjected();
			if (!tierInfo) {
				tierInfo = await getWanderTierInfo(walletAddress);
			}

			if (!tierInfo) {
				console.error('Could not fetch current tier info');
				return false;
			}

			console.log(`Current tier: ${tierInfo.tier}, attempting to advance...`);

			// Prepare campaign completion data
			const campaignData = {
				profileId,
				walletAddress,
				currentTier: tierInfo.tier,
				completedAt: new Date().toISOString(),
				questsCompleted: ['create-profile', 'create-asset', 'create-collection', 'make-purchase', 'stake-pixel'],
				platform: 'bazar',
				campaignType: 'wander-quest-completion',
			};

			// Submit tier advancement request to Wander team
			const success = await requestTierAdvancement(walletAddress, campaignData);

			if (success) {
				console.log('✅ Tier advancement request submitted successfully!');
			} else {
				console.error('❌ Failed to submit tier advancement request');
			}

			return success;
		} catch (error) {
			console.error('Error attempting tier advancement:', error);
			return false;
		}
	}
}

export const questTracker = QuestTracker.getInstance();
