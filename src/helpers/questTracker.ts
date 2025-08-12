import { messageResult, readHandler } from 'api';

import { AO } from 'helpers/config';
import {
	calculateTierRewards,
	getTierQuestDescription,
	getWanderTierInfo,
	getWanderTierInfoInjected,
} from 'helpers/wanderTier';
import { completeQuest, updateQuestProgress } from 'store/quests';
import { QuestProgress } from 'store/quests/types';

export class QuestTracker {
	private static instance: QuestTracker;
	private dispatch: any;

	private constructor() {}

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
					await messageResult({
						processId: AO.pixl,
						action: 'Calculate-Streak',
						tags: [{ name: 'Buyer', value: buyerProfileId }],
						data: null,
					});
				} catch (error) {
					console.error('Error calculating PIXL streak:', error);
				}
			}
		} catch (error) {
			console.error('Error tracking purchase:', error);
		}
	}

	/**
	 * Track PIXL staking
	 */
	public async trackPixelStaking(profileId: string, stakedAmount: string) {
		if (!this.dispatch) return;

		try {
			// This would need to be implemented based on your staking system
			// For now, we'll simulate staking tracking
			const progress: Partial<QuestProgress> = {
				pixelStaked: true,
			};

			this.dispatch(updateQuestProgress(progress));
			this.checkQuestCompletion('stake-pixel');
		} catch (error) {
			console.error('Error tracking PIXL staking:', error);
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
			'stake-pixel': () => true, // If this function is called, PIXL is staked
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
			const profile = await readHandler({
				processId: profileId,
				action: 'Info',
				data: null,
			});

			if (!profile) {
				return {};
			}

			const assetIds = profile.Assets.filter((asset: any) => asset.Id !== 'wAR' && asset.Id !== 'PIXL').map(
				(asset: any) => asset.Id
			);

			const progress: Partial<QuestProgress> = {
				profileCreated: true,
				totalAssets: assetIds.length,
				firstAssetCreated: assetIds.length > 0,
				// TODO: Implement collection and purchase tracking
				totalCollections: 0,
				firstCollectionCreated: false,
				totalPurchases: 0,
				firstPurchaseMade: false,
				pixelStaked: false,
			};

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

			return progress;
		} catch (error) {
			console.error('Error getting quest progress:', error);
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
}

export const questTracker = QuestTracker.getInstance();
