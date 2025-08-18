import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import { messageResult, readHandler } from 'api';

import { Modal } from 'components/molecules/Modal';
import { Panel } from 'components/molecules/Panel';
import { ProfileManage } from 'components/organisms/ProfileManage';
import { ASSETS, DELEGATION, URLS } from 'helpers/config';
import { calculateDelegationLimits, getDelegations } from 'helpers/delegationUtils';
import { getTxEndpoint } from 'helpers/endpoints';
import { questTracker } from 'helpers/questTracker';
import { formatAddress } from 'helpers/utils';
import {
	calculateTierRewards,
	getEarnedProfileRings,
	getHighestProfileRing,
	getProfileRingForQuest,
	getTierMultiplier,
	getTierQuestDescription,
	WANDER_PROFILE_RINGS,
} from 'helpers/wanderTier';
import { useArweaveProvider } from 'providers/ArweaveProvider';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { usePermawebProvider } from 'providers/PermawebProvider';
import { RootState } from 'store';
import { claimQuestReward, completeQuest, Quest, QuestProgress, setQuests, updateQuestProgress } from 'store/quests';

import * as S from './styles';

// Feature flag to enable/disable quest system
const ENABLE_QUEST_SYSTEM = true;

// Campaign 2 Integration - Load assets dynamically from existing DumDum Trials system
const CAMPAIGN_2_MAIN = 'paQoFK6zVdqjHSY_s-O0Hzu_HD50zOUAWk-WibMDe8g';
const BRIDGE_DRIVE_VERSION_KEY = 'bridge-drive-version';
const CURRENT_VERSION = '2.5';
const DRIVE_CONFIG_KEY = 'drive-config';

// Will be populated dynamically from Campaign 2 config (DumDum Trials)
let CAMPAIGN_2_ASSETS: Array<{
	id: string;
	title: string;
	description: string;
	questRequirement: string;
	cover: string;
	name: string;
	isMainAsset: boolean;
}> = [];

const QUEST_CONFIG = {
	createProfile: {
		id: 'create-profile',
		title: 'Create Profile',
		description: 'Create your Bazar profile (requires Wander wallet)',
		icon: ASSETS.user,
		required: 1,
		tier: 'bronze' as const,
		reward: {
			wndr: 10,
			description: '10 WNDR + Bronze & Silver DumDums',
			profileRing: 'wander-explorer',
		},
	},
	createAsset: {
		id: 'create-asset',
		title: 'Create Your First Asset',
		description: 'Upload and create your first atomic asset',
		icon: ASSETS.asset,
		required: 1,
		tier: 'silver' as const,
		reward: {
			wndr: 25,
			description: '25 WNDR',
			profileRing: 'wander-creator',
		},
	},
	createCollection: {
		id: 'create-collection',
		title: 'Create Your First Collection',
		description: 'Create a collection to organize your assets',
		icon: ASSETS.collection,
		required: 1,
		tier: 'silver' as const,
		reward: {
			wndr: 25,
			description: '25 WNDR (Collection bonus)',
		},
	},
	makePurchase: {
		id: 'make-purchase',
		title: 'Make Your First Purchase',
		description: 'Buy your first atomic asset from marketplace',
		icon: ASSETS.buy,
		required: 1,
		tier: 'gold' as const,
		reward: {
			wndr: 50,
			description: '50 WNDR + Fourth DumDum',
			profileRing: 'wander-trader',
		},
	},
	delegatePixl: {
		id: 'delegate-pixl',
		title: 'Delegate to PIXL',
		description: 'Delegate at least 10% voting power to PIXL + stamp your Silver DumDum',
		icon: ASSETS.star,
		required: 1,
		tier: 'platinum' as const,
		reward: {
			wndr: 100,
			description: '100 WNDR + Platinum DumDum',
			profileRing: 'wander-champion',
		},
	},
};

export default function Quests() {
	const navigate = useNavigate();
	const dispatch = useDispatch();

	const permawebProvider = usePermawebProvider();
	const arProvider = useArweaveProvider();
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const questsState = useSelector((state: RootState) => state.questsReducer);
	const { quests, progress } = questsState;

	const [showProfileManage, setShowProfileManage] = React.useState<boolean>(false);
	const [claimingQuest, setClaimingQuest] = React.useState<string | null>(null);
	const [claimNotification, setClaimNotification] = React.useState<{ questId: string; reward: any } | null>(null);
	const [wanderTierInfo, setWanderTierInfo] = React.useState<any>(null);
	const [campaignCompleted, setCampaignCompleted] = React.useState<boolean>(false);
	const [tierAdvancementAttempted, setTierAdvancementAttempted] = React.useState<boolean>(false);
	const [earnedProfileRings, setEarnedProfileRings] = React.useState<string[]>([]);
	const [currentProfileRing, setCurrentProfileRing] = React.useState<string | null>(null);

	// Campaign 2 Assets State (DumDum Trials)
	const [campaign2Assets, setCampaign2Assets] = React.useState<
		Array<{
			id: string;
			title: string;
			description: string;
			questRequirement: string;
			requirementType?: string;
			cover: string;
			name: string;
			claimable: boolean;
			claimed: boolean;
			claimInProgress: boolean;
			isMainAsset: boolean;
			contentType?: string;
		}>
	>([]);
	const [campaign2Loading, setCampaign2Loading] = React.useState<boolean>(true);

	// Initialize quests on component mount
	React.useEffect(() => {
		if (quests.length === 0) {
			const initialQuests: Quest[] = Object.values(QUEST_CONFIG).map((config) => ({
				...config,
				completed: 0,
				isCompleted: false,
				isClaimed: false,
			}));
			dispatch(setQuests(initialQuests));
		}
	}, [dispatch, quests.length]);

	// Initialize quest tracker with dispatch
	React.useEffect(() => {
		questTracker.setDispatch(dispatch);
	}, [dispatch]);

	// Check quest progress when profile or wallet changes - made optional
	React.useEffect(() => {
		if (ENABLE_QUEST_SYSTEM && arProvider.walletAddress && permawebProvider.profile) {
			try {
				checkQuestProgress();
				checkDelegationStatus();
			} catch (error) {
				console.log('Quest tracking failed:', error);
				// Fail silently - don't break the app
			}
		}
	}, [arProvider.walletAddress, permawebProvider.profile, permawebProvider.tokenBalances]);

	// Periodic delegation check - made optional
	React.useEffect(() => {
		if (ENABLE_QUEST_SYSTEM && arProvider.walletAddress) {
			const interval = setInterval(() => {
				try {
					checkDelegationStatus();
				} catch (error) {
					console.log('Delegation check failed:', error);
					// Fail silently
				}
			}, 60000); // Reduced frequency to every 60 seconds

			return () => clearInterval(interval);
		}
	}, [arProvider.walletAddress]);

	// Load Campaign 2 assets when component mounts
	React.useEffect(() => {
		if (ENABLE_QUEST_SYSTEM) {
			try {
				loadCampaign2Assets();
			} catch (error) {
				console.log('Campaign 2 asset loading failed:', error);
				// Fail silently
			}
		}
	}, []);

	// Check Campaign 2 asset claim status when assets are loaded and quests change (debounced)
	React.useEffect(() => {
		if (
			ENABLE_QUEST_SYSTEM &&
			arProvider.walletAddress &&
			permawebProvider.profile &&
			campaign2Assets.length > 0 &&
			quests.length > 0
		) {
			// Debounce claim status checks to avoid rapid API calls
			const timeoutId = setTimeout(() => {
				try {
					checkCampaign2ClaimStatus();
				} catch (error) {
					console.log('Campaign 2 asset check failed:', error);
					// Fail silently
				}
			}, 1000); // 1 second debounce

			return () => clearTimeout(timeoutId);
		} else {
			// Reduced logging frequency
			if (Math.random() < 0.1) {
				// Only log 10% of the time
				console.log('Campaign 2 claim check skipped - missing requirements');
			}
		}
	}, [arProvider.walletAddress, permawebProvider.profile, campaign2Assets.length, quests]);

	// Update quests with tier-based rewards when Wander tier info is available
	React.useEffect(() => {
		if (wanderTierInfo && quests.length > 0) {
			updateQuestsWithTierRewards();
		}
	}, [wanderTierInfo, quests.length]);

	// Check campaign completion status
	React.useEffect(() => {
		if (arProvider.walletAddress) {
			checkCampaignCompletion();
		}
	}, [progress, arProvider.walletAddress, permawebProvider.profile?.id]);

	async function checkQuestProgress() {
		if (!arProvider.walletAddress) return;

		console.log('Quests - checkQuestProgress called with:', {
			walletAddress: arProvider.walletAddress,
			permawebProfileId: permawebProvider.profile?.id,
			isLegacyProfile: permawebProvider.profile?.isLegacyProfile,
		});

		// ALWAYS try to fetch the HyperBeam zone profile first, since legacy profiles are deprecated
		console.log('Quests - Attempting to fetch HyperBeam zone profile directly...');
		let profileIdToUse = null;

		try {
			// Always try to get the zone profile first (HyperBeam profiles)
			const zoneProfile = await permawebProvider.libs?.getProfileByWalletAddress(arProvider.walletAddress);
			if (zoneProfile?.id) {
				console.log('Quests - ✅ Found HyperBeam zone profile ID:', zoneProfile.id);
				console.log('Quests - Zone profile type:', zoneProfile.isLegacyProfile ? 'Legacy' : 'HyperBeam');
				profileIdToUse = zoneProfile.id;
			} else {
				console.log('Quests - ❌ HyperBeam zone profile not found');
			}
		} catch (error) {
			console.log('Quests - ❌ HyperBeam zone profile fetch failed:', error);
		}

		// Only fall back to provider profile if zone profile fetch completely failed
		if (!profileIdToUse) {
			console.log('Quests - Falling back to PermawebProvider profile ID...');
			profileIdToUse = permawebProvider.profile?.id;
			console.log(
				'Quests - Fallback profile type:',
				permawebProvider.profile?.isLegacyProfile ? 'Legacy' : 'HyperBeam'
			);
		}

		console.log('Quests - Using profile ID for quest tracking:', profileIdToUse);
		console.log('Quests - Current Redux progress state before update:', progress);
		console.log('Quests - PermawebProvider profile ID:', permawebProvider.profile?.id);
		console.log('Quests - PermawebProvider profile isLegacy:', permawebProvider.profile?.isLegacyProfile);

		// Use the quest tracker to get comprehensive progress
		const freshProgress = await questTracker.getQuestProgress(profileIdToUse, arProvider.walletAddress);
		console.log('Quests - Fresh progress from quest tracker:', freshProgress);

		dispatch(updateQuestProgress(freshProgress));

		// Auto-complete quests based on FRESH progress data
		console.log('Quests - Auto-completing quests based on fresh progress...');

		// Profile quest - use direct provider check as fallback
		if (freshProgress.profileCreated || permawebProvider.profile?.id) {
			if (!quests.find((q) => q.id === 'create-profile')?.isCompleted) {
				console.log('Quests - Completing create-profile quest');
				dispatch(completeQuest('create-profile'));
			}
		}

		// Other quests based on fresh progress data
		if (freshProgress.firstAssetCreated && !quests.find((q) => q.id === 'create-asset')?.isCompleted) {
			console.log('Quests - Completing create-asset quest');
			dispatch(completeQuest('create-asset'));
		}
		if (freshProgress.firstCollectionCreated && !quests.find((q) => q.id === 'create-collection')?.isCompleted) {
			console.log('Quests - Completing create-collection quest');
			dispatch(completeQuest('create-collection'));
		}
		if (freshProgress.firstPurchaseMade && !quests.find((q) => q.id === 'make-purchase')?.isCompleted) {
			console.log('Quests - Completing make-purchase quest');
			dispatch(completeQuest('make-purchase'));
		}
		if (
			freshProgress.pixelDelegated &&
			freshProgress.hasStampedSilverDumDum &&
			!quests.find((q) => q.id === 'delegate-pixl')?.isCompleted
		) {
			console.log('Quests - Completing delegate-pixl quest (both delegation and Silver DumDum stamping completed)');
			dispatch(completeQuest('delegate-pixl'));
		}

		// Store Wander tier info for quest updates
		if (freshProgress.wanderTier) {
			console.log('Quests - Setting Wander tier info:', freshProgress.wanderTier);
			setWanderTierInfo({
				tier: freshProgress.wanderTier,
				balance: freshProgress.wanderBalance,
				rank: freshProgress.wanderRank,
			});
		}
	}

	async function checkDelegationStatus() {
		if (!arProvider.walletAddress) return;

		try {
			// Only check delegation if delegation utils are available
			if (typeof getDelegations === 'function') {
				await questTracker.trackPixelDelegation(arProvider.walletAddress);
			}
		} catch (error) {
			console.log('Delegation check unavailable:', error);
			// Fail silently - delegation features are optional
		}
	}

	function updateQuestsWithTierRewards() {
		if (!wanderTierInfo) return;

		const updatedQuests = quests.map((quest) => {
			const baseReward = QUEST_CONFIG[quest.id as keyof typeof QUEST_CONFIG];
			if (!baseReward) return quest;

			const tierRewards = calculateTierRewards(baseReward.reward.wndr, wanderTierInfo.tier);
			const tierDescription = getTierQuestDescription(quest.id, wanderTierInfo.tier);

			return {
				...quest,
				description: tierDescription,
				reward: {
					wndr: tierRewards.wndr,
					description: `${tierRewards.wndr} WNDR (${wanderTierInfo.tier} tier - ${tierRewards.multiplier}x)${
						(baseReward.reward as any).profileRing ? ' + Profile Ring' : ''
					}`,
					multiplier: tierRewards.multiplier,
					tier: wanderTierInfo.tier,
					...((baseReward.reward as any).profileRing && { profileRing: (baseReward.reward as any).profileRing }),
				},
			};
		});

		dispatch(setQuests(updatedQuests));
	}

	async function checkCampaignCompletion() {
		if (!arProvider.walletAddress) return;

		console.log('Quests - checkCampaignCompletion called');

		// ALWAYS try to get the HyperBeam zone profile for campaign completion
		console.log('Quests - Fetching HyperBeam zone profile for campaign completion...');
		let profileIdToUse = null;

		try {
			const zoneProfile = await permawebProvider.libs?.getProfileByWalletAddress(arProvider.walletAddress);
			if (zoneProfile?.id) {
				profileIdToUse = zoneProfile.id;
				console.log('Quests - ✅ Using HyperBeam zone profile for campaign completion:', profileIdToUse);
			}
		} catch (error) {
			console.log('Quests - ❌ HyperBeam zone profile fetch failed for campaign completion:', error);
		}

		// Only fall back if zone profile fetch failed
		if (!profileIdToUse) {
			profileIdToUse = permawebProvider.profile?.id;
			console.log('Quests - Using fallback profile for campaign completion:', profileIdToUse);
		}

		if (!profileIdToUse) return;

		try {
			const completed = await questTracker.hasCompletedWanderCampaign(profileIdToUse);
			setCampaignCompleted(completed);

			// Attempt tier advancement if campaign is completed and not already attempted
			if (completed && !tierAdvancementAttempted && arProvider.walletAddress) {
				const advancementAttempted = await questTracker.tryAdvanceWanderTier(profileIdToUse, arProvider.walletAddress);

				if (advancementAttempted) {
					setTierAdvancementAttempted(true);
					// Show special notification for campaign completion
					setClaimNotification({
						questId: 'campaign-complete',
						reward: {
							wndr: 0,
							pixel: 0,
							description: 'Wander Campaign Completed! Tier advancement requested.',
							campaignComplete: true,
						},
					});
				}
			}
		} catch (error) {
			console.error('Error checking campaign completion:', error);
		}
	}

	async function handleClaimQuest(questId: string) {
		if (!arProvider.walletAddress || !permawebProvider.profile) return;

		setClaimingQuest(questId);

		try {
			// Simulate API call to claim WNDR rewards
			await new Promise((resolve) => setTimeout(resolve, 2000));

			// Update quest state
			dispatch(claimQuestReward(questId));

			// Unlock profile ring for this quest
			const quest = quests.find((q) => q.id === questId);
			if (quest && quest.reward.profileRing) {
				unlockProfileRing(quest.reward.profileRing);
			}

			// Show notification
			if (quest) {
				setClaimNotification({ questId, reward: quest.reward });
			}
		} catch (error) {
			console.error('Error claiming quest reward:', error);
		} finally {
			setClaimingQuest(null);
		}
	}

	function unlockProfileRing(ringId: string) {
		setEarnedProfileRings((prev) => {
			if (prev.includes(ringId)) return prev;
			const newRings = [...prev, ringId];

			// Update current profile ring to the highest tier ring earned
			const completedQuests = quests.filter((q) => q.isClaimed).map((q) => q.id);
			const highestRing = getHighestProfileRing(completedQuests);
			if (highestRing) {
				setCurrentProfileRing(highestRing.id);
			}

			return newRings;
		});

		// Store in localStorage for persistence
		const storageKey = `wander-profile-rings-${arProvider.walletAddress}`;
		const updatedRings = [...earnedProfileRings, ringId];
		localStorage.setItem(storageKey, JSON.stringify(updatedRings));
	}

	// Campaign 2 Configuration Loading (DumDum Trials)
	async function loadCampaign2Assets() {
		setCampaign2Loading(true);
		try {
			// Load Campaign 2 configuration (same logic as Campaign 2 component)
			let config: any;
			const storedVersion = localStorage.getItem(BRIDGE_DRIVE_VERSION_KEY);
			const storedConfig = localStorage.getItem(DRIVE_CONFIG_KEY);

			// Clear old Campaign 1 config if it exists
			if (localStorage.getItem('drive-config')) {
				console.log('Clearing old Campaign 1 config...');
				localStorage.removeItem('drive-config');
			}

			if (storedConfig) {
				config = JSON.parse(storedConfig);
				console.log('Using stored Campaign 2 config:', config);
			}

			if (!storedConfig || storedVersion !== CURRENT_VERSION) {
				try {
					console.log('Loading Campaign 2 (DumDum Trials) config from process...');
					const response = await readHandler({
						processId: CAMPAIGN_2_MAIN,
						action: 'Get-Config',
					});

					localStorage.setItem(DRIVE_CONFIG_KEY, JSON.stringify(response));
					localStorage.setItem(BRIDGE_DRIVE_VERSION_KEY, CURRENT_VERSION);
					config = JSON.parse(localStorage.getItem(DRIVE_CONFIG_KEY));
				} catch (e) {
					console.error('Failed to fetch Campaign 2 drive config:', e);
				}
			}

			if (config && config.Assets) {
				// Updated mapping to align with DumDum Trials requirements:
				// Bronze: Wander wallet (covered by profile creation), Silver: Create profile, Gold: Stamp asset, Platinum: Complete all
				const questToAssetMap = [
					{ questId: 'create-profile', assetIndex: '0', requirement: 'wander' }, // Bronze DumDum - Having Wander wallet (prerequisite for profile)
					{ questId: 'create-profile', assetIndex: '1', requirement: 'wander' }, // Silver DumDum - Create profile on Bazar
					{ questId: 'create-profile', assetIndex: '2', requirement: 'stamping' }, // Gold DumDum - Need to stamp an asset (shown in profile quest for convenience)
					{ questId: 'make-purchase', assetIndex: '3', requirement: 'wander' }, // Fourth DumDum - Make purchase aligns
					{ questId: 'delegate-pixl', assetIndex: 'main', requirement: 'wander' }, // Platinum DumDum - Complete all Wander quests
				];

				const assets = [];

				// Add main asset (Platinum DumDum)
				console.log('Main asset config:', {
					id: CAMPAIGN_2_MAIN,
					name: config.Name,
					cover: config.Cover,
					hasValidCover: !!config.Cover && config.Cover !== 'undefined',
				});

				assets.push({
					id: CAMPAIGN_2_MAIN,
					title: 'Platinum DumDum',
					name: config.Name ?? 'Platinum DumDum',
					description: 'The ultimate Platinum DumDum reward for completing all Wander quests',
					questRequirement: 'delegate-pixl',
					cover: config.Cover && config.Cover !== 'undefined' ? config.Cover : null,
					claimable: false,
					claimed: false,
					claimInProgress: false,
					isMainAsset: true,
				});

				// Add sub assets (Colored DumDums)
				Object.keys(config.Assets).forEach((key, index) => {
					const asset = config.Assets[key];
					const questMapping = questToAssetMap.find((q) => q.assetIndex === asset.GridPlacement);

					console.log(`Campaign 2 Asset ${key}:`, {
						id: asset.Id,
						name: asset.Name,
						cover: asset.Cover,
						gridPlacement: asset.GridPlacement,
						questMapping: questMapping,
					});

					if (questMapping) {
						let description;
						if (questMapping.requirement === 'wander') {
							// Specific descriptions for each DumDum based on their requirements
							if (questMapping.assetIndex === '0') {
								description = `Bronze ${asset.Name || 'DumDum'} - Create a Wander wallet (unlocked with Bazar profile)`;
							} else if (questMapping.assetIndex === '1') {
								description = `Silver ${asset.Name || 'DumDum'} - Create your Bazar profile`;
							} else if (questMapping.assetIndex === '2') {
								description = `Gold ${asset.Name || 'DumDum'} - Create your first asset`;
							} else if (questMapping.assetIndex === '3') {
								description = `${asset.Name || 'DumDum'} - Make your first purchase`;
							} else {
								description = `Exclusive ${asset.Name || 'DumDum'} for completing Wander quest: ${
									questMapping.questId
								}`;
							}
						} else {
							// Original/modified DumDum requirements
							if (questMapping.assetIndex === '2') {
								description = `Gold ${asset.Name || 'DumDum'} - Stamp (like) any asset to unlock`;
							} else {
								description = `Exclusive ${asset.Name || 'DumDum'} - Complete original DumDum Trials requirement`;
							}
						}

						assets.push({
							id: asset.Id,
							title: asset.Name || `DumDum ${parseInt(asset.GridPlacement) + 1}`,
							name: asset.Name,
							description: description,
							questRequirement: questMapping.questId,
							requirementType: questMapping.requirement,
							cover: asset.Cover && asset.Cover !== 'undefined' ? asset.Cover : null,
							claimable: false,
							claimed: false,
							claimInProgress: false,
							isMainAsset: false,
						});
					} else {
						console.log(`No quest mapping found for asset with GridPlacement: ${asset.GridPlacement}`);
					}
				});

				setCampaign2Assets(assets);
				console.log('Loaded Campaign 2 (DumDum Trials) assets:', assets);
			}
		} catch (error) {
			console.error('Error loading Campaign 2 assets:', error);
		} finally {
			setCampaign2Loading(false);
		}
	}

	// Campaign 2 Asset Claiming Functions (using existing Campaign system logic)
	async function checkCampaign2ClaimStatus() {
		if (!arProvider.walletAddress || !permawebProvider.profile || campaign2Assets.length === 0) {
			console.log('Skipping claim status check - missing requirements');
			return;
		}

		// Use caching to avoid excessive API calls
		const cacheKey = `campaign2-claims-${arProvider.walletAddress}-${permawebProvider.profile.id}`;
		const cachedResult = sessionStorage.getItem(cacheKey);
		const cacheTime = sessionStorage.getItem(`${cacheKey}-time`);
		const now = Date.now();

		// Use 5-minute cache for claim status
		if (cachedResult && cacheTime && now - parseInt(cacheTime) < 300000) {
			console.log('Using cached Campaign 2 claim status');
			setCampaign2Assets(JSON.parse(cachedResult));
			return;
		}

		console.log('Checking Campaign 2 claim status for', campaign2Assets.length, 'assets');

		try {
			const updatedAssets = await Promise.all(
				campaign2Assets.map(async (asset) => {
					// Use the same claim checking logic as Campaign 2
					const tags = [
						{ name: 'Address', value: arProvider.walletAddress },
						{ name: 'ProfileId', value: permawebProvider.profile.id },
					];

					try {
						// Initialize claim check silently
						await messageResult({
							processId: asset.id,
							wallet: arProvider.wallet,
							action: 'Init-Claim-Check',
							tags: tags,
							data: null,
						});

						// Get claim status
						const response = await messageResult({
							processId: asset.id,
							wallet: arProvider.wallet,
							action: 'Get-Claim-Status',
							tags: tags,
							data: null,
						});

						console.log(`Claim status response for ${asset.title}:`, response);

						let claimable = false;
						let claimed = false;

						if (response && response['Claim-Status-Response'] && response['Claim-Status-Response'].status) {
							claimable = response['Claim-Status-Response'].status === 'Claimable';
							claimed = response['Claim-Status-Response'].status === 'Claimed';
							console.log(`${asset.title} status: claimable=${claimable}, claimed=${claimed}`);
						} else {
							console.log(`No valid claim response for ${asset.title}`);
						}

						// Check if requirements are met based on type
						let requirementMet = false;
						if (asset.requirementType === 'wander') {
							// Check Wander quest completion
							const correspondingQuest = quests.find((q) => q.id === asset.questRequirement);
							requirementMet = correspondingQuest && correspondingQuest.isCompleted;
							console.log(`${asset.title} Wander quest (${asset.questRequirement}) completed: ${requirementMet}`);
						} else if (asset.requirementType === 'stamping') {
							// Check if user has stamped any asset (for Gold DumDum)
							requirementMet = progress.hasStampedAsset === true;
							console.log(`${asset.title} stamping requirement met: ${requirementMet}`);
						} else {
							// Original DumDum requirements - let the original claim system handle it
							requirementMet = claimable; // If Campaign 2 says it's claimable, trust it
							console.log(`${asset.title} original requirement met: ${requirementMet}`);
						}

						const finalState = {
							...asset,
							claimable: claimable && requirementMet,
							claimed: claimed,
							claimInProgress: false,
						};

						// Final state determined
						return finalState;
					} catch (error) {
						console.error(`Error checking claim status for ${asset.title}:`, error);
						return {
							...asset,
							claimable: false,
							claimed: false,
							claimInProgress: false,
						};
					}
				})
			);

			// Cache the result for 5 minutes
			sessionStorage.setItem(cacheKey, JSON.stringify(updatedAssets));
			sessionStorage.setItem(`${cacheKey}-time`, now.toString());

			setCampaign2Assets(updatedAssets);
			console.log('Campaign 2 claim status updated and cached');
		} catch (error) {
			console.error('Error checking Campaign 2 asset claim status:', error);
		}
	}

	async function handleClaimCampaign2Asset(assetId: string) {
		if (!arProvider.walletAddress || !permawebProvider.profile) return;

		// Update UI to show claiming in progress
		setCampaign2Assets((prev) =>
			prev.map((asset) => (asset.id === assetId ? { ...asset, claimInProgress: true } : asset))
		);

		const tags = [
			{ name: 'Address', value: arProvider.walletAddress },
			{ name: 'ProfileId', value: permawebProvider.profile.id },
		];

		try {
			const response = await messageResult({
				processId: assetId,
				wallet: arProvider.wallet,
				action: 'Handle-Claim',
				tags: tags,
				data: null,
			});

			if (response && response['Claim-Status-Response'] && response['Claim-Status-Response'].status === 'Claimed') {
				// Update asset state to claimed
				setCampaign2Assets((prev) =>
					prev.map((asset) =>
						asset.id === assetId ? { ...asset, claimable: false, claimed: true, claimInProgress: false } : asset
					)
				);

				// Show success notification
				const asset = campaign2Assets.find((a) => a.id === assetId);
				if (asset) {
					setClaimNotification({
						questId: asset.questRequirement,
						reward: { atomicAsset: asset.title },
					});
				}
			}
		} catch (error) {
			console.error('Error claiming Campaign 2 asset:', error);
		} finally {
			// Reset claiming state
			setCampaign2Assets((prev) =>
				prev.map((asset) => (asset.id === assetId ? { ...asset, claimInProgress: false } : asset))
			);
		}
	}

	// Load earned profile rings from localStorage on wallet connection
	React.useEffect(() => {
		if (arProvider.walletAddress) {
			const storageKey = `wander-profile-rings-${arProvider.walletAddress}`;
			const storedRings = localStorage.getItem(storageKey);
			if (storedRings) {
				try {
					const rings = JSON.parse(storedRings);
					setEarnedProfileRings(rings);

					// Set current profile ring to highest tier
					const completedQuests = quests.filter((q) => q.isClaimed).map((q) => q.id);
					const highestRing = getHighestProfileRing(completedQuests);
					if (highestRing) {
						setCurrentProfileRing(highestRing.id);
					}
				} catch (error) {
					console.error('Error loading profile rings:', error);
				}
			}
		} else {
			setEarnedProfileRings([]);
			setCurrentProfileRing(null);
		}
	}, [arProvider.walletAddress, quests]);

	function getQuestProgress(questId: string): number {
		switch (questId) {
			case 'create-profile':
				return progress.profileCreated ? 1 : 0;
			case 'create-asset':
				return progress.firstAssetCreated ? 1 : 0;
			case 'create-collection':
				return progress.firstCollectionCreated ? 1 : 0;
			case 'make-purchase':
				return progress.firstPurchaseMade ? 1 : 0;
			case 'delegate-pixl':
				return progress.pixelDelegated ? 1 : 0;
			default:
				return 0;
		}
	}

	function isQuestCompleted(questId: string): boolean {
		return getQuestProgress(questId) >= QUEST_CONFIG[questId as keyof typeof QUEST_CONFIG]?.required;
	}

	function getQuestCard(quest: Quest) {
		const questProgress = getQuestProgress(quest.id);
		const completed = isQuestCompleted(quest.id);
		const isClaiming = claimingQuest === quest.id;
		const hasTierMultiplier = quest.reward.multiplier && quest.reward.multiplier > 1;

		// Find all corresponding Campaign 2 assets for this quest
		const correspondingAssets = campaign2Assets.filter((asset) => asset.questRequirement === quest.id);
		const correspondingAsset = correspondingAssets[0]; // Keep first one for backward compatibility

		return (
			<S.QuestCard key={quest.id} completed={completed} claimed={quest.isClaimed}>
				<S.QuestHeader>
					<S.QuestIcon>
						<img src={quest.icon} alt={quest.title} />
					</S.QuestIcon>
					<S.QuestInfo>
						<S.QuestTitle>{quest.title}</S.QuestTitle>
						<S.QuestDescription>{quest.description}</S.QuestDescription>
						{correspondingAsset && (
							<div style={{ marginTop: '8px' }}>
								<small style={{ color: '#9ca3af' }}>Unlocks: {correspondingAsset.title}</small>
							</div>
						)}
						<S.QuestProgress>
							{questProgress} / {quest.required}
						</S.QuestProgress>
					</S.QuestInfo>
					<S.QuestTier tier={quest.tier}>
						{quest.tier.toUpperCase()}
						{hasTierMultiplier && <S.TierMultiplier>{quest.reward.multiplier}x</S.TierMultiplier>}
					</S.QuestTier>
				</S.QuestHeader>

				<S.QuestReward>
					<S.RewardIcon>
						<img src={ASSETS.star} alt="Reward" />
					</S.RewardIcon>
					<div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
						<div style={{ flex: 1 }}>
							<S.RewardText>{quest.reward.description}</S.RewardText>
							{correspondingAssets.length > 0 && (
								<div style={{ marginTop: '4px', fontSize: '0.8rem', color: '#9ca3af' }}>
									{correspondingAssets.map((asset) => asset.title).join(' + ')}
								</div>
							)}
							{hasTierMultiplier && <S.TierBoost>🎯 {quest.reward.tier} Boost Active!</S.TierBoost>}
						</div>
						{correspondingAssets.length > 0 && (
							<div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
								{correspondingAssets.map((asset) => (
									<div
										key={asset.id}
										style={{
											width: correspondingAssets.length > 1 ? '24px' : '50px',
											height: correspondingAssets.length > 1 ? '24px' : '50px',
											borderRadius: '4px',
											overflow: 'hidden',
											border: asset.claimable ? '1px solid #1fd014' : '1px solid #595959',
											boxShadow: asset.claimable ? '0 0 3px 1px #5AF650' : '0 0 2px 1px #595959',
											transition: 'all 0.2s ease',
										}}
										title={`Preview: ${asset.title}`}
									>
										{(() => {
											// Validate asset ID/cover before creating URL
											const assetId = asset.claimed ? asset.id : asset.cover;
											if (!assetId || assetId === 'undefined') {
												return (
													<div
														style={{
															width: '100%',
															height: '100%',
															backgroundColor: '#374151',
															display: 'flex',
															alignItems: 'center',
															justifyContent: 'center',
															color: '#9ca3af',
															fontSize: '10px',
															textAlign: 'center',
														}}
													>
														Asset Loading...
													</div>
												);
											}

											return (asset.contentType && asset.contentType.includes('video')) ||
												(asset.isMainAsset && asset.title.includes('Platinum')) ? (
												<video
													src={getTxEndpoint(assetId)}
													style={{ width: '100%', height: '100%', objectFit: 'cover' }}
													muted
													autoPlay
													loop
													onError={() => {
														if (shouldLogError(assetId + '_video')) {
															console.warn(`Failed to load quest preview video for ${asset.title}, using fallback`);
														}
													}}
												/>
											) : (
												<img
													src={getTxEndpoint(assetId)}
													alt={asset.title}
													style={{ width: '100%', height: '100%', objectFit: 'cover' }}
													onError={(e) => {
														// Prevent infinite loop by checking if we're already showing fallback
														if (e.currentTarget.src.includes('star')) {
															return;
														}
														// Debounced error logging
														if (shouldLogError(assetId + '_image')) {
															console.warn(`Failed to load quest preview image for ${asset.title}, using fallback`);
														}
														// Set fallback image only once
														e.currentTarget.src = ASSETS.star;
													}}
												/>
											);
										})()}
									</div>
								))}
							</div>
						)}
					</div>
				</S.QuestReward>

				<S.QuestAction>
					{completed && !quest.isClaimed ? (
						<S.ClaimButton onClick={() => handleClaimQuest(quest.id)} disabled={isClaiming}>
							{isClaiming ? 'Claiming...' : 'Claim Reward'}
						</S.ClaimButton>
					) : quest.isClaimed ? (
						<S.ClaimedBadge>
							<img src={ASSETS.checkmark} alt="Claimed" />
							Claimed
						</S.ClaimedBadge>
					) : quest.id === 'delegate-pixl' ? (
						<S.DelegationAction>
							{/* Only show progress bar if there's actual delegation progress */}
							{progress.pixelDelegationPercentage && progress.pixelDelegationPercentage > 0 && (
								<S.ProgressBar>
									<S.ProgressFill progress={Math.min((progress.pixelDelegationPercentage / 10) * 100, 100)} />
								</S.ProgressBar>
							)}
							<S.DelegationButton
								onClick={() => {
									// Trigger the header delegation button click
									const delegationBtn = document.querySelector('[data-delegation-button]') as HTMLElement;
									if (delegationBtn) {
										delegationBtn.click();
									} else {
										// Fallback: navigate to a route that has delegation
										window.location.href = window.location.origin + window.location.pathname;
									}
								}}
							>
								Open Delegation Panel
							</S.DelegationButton>
							<S.DelegationStatus>
								{progress.pixelDelegationPercentage !== undefined && (
									<div>Delegation: {progress.pixelDelegationPercentage.toFixed(1)}% (need 10%+)</div>
								)}
								<div>Silver DumDum Stamping: {progress.hasStampedSilverDumDum ? '✅ Done' : '❌ Pending'}</div>
							</S.DelegationStatus>
						</S.DelegationAction>
					) : (
						<S.ProgressBar>
							<S.ProgressFill progress={(questProgress / quest.required) * 100} />
						</S.ProgressBar>
					)}
				</S.QuestAction>
			</S.QuestCard>
		);
	}

	function getProfileRingCard(ringId: string) {
		const ring = WANDER_PROFILE_RINGS[ringId as keyof typeof WANDER_PROFILE_RINGS];
		if (!ring) return null;

		return (
			<S.ProfileRingCard key={ring.id}>
				<S.ProfileRingPreview>
					<S.ProfileRingAvatar>
						<S.ProfileRingBorder color={ring.color} />
						<img src={ASSETS.user} alt="Profile Preview" />
					</S.ProfileRingAvatar>
					<S.ProfileRingActive isActive={currentProfileRing === ring.id}>
						{currentProfileRing === ring.id ? 'ACTIVE' : 'EARNED'}
					</S.ProfileRingActive>
				</S.ProfileRingPreview>
				<S.ProfileRingInfo>
					<S.ProfileRingName>{ring.name}</S.ProfileRingName>
					<S.ProfileRingDescription>{ring.description}</S.ProfileRingDescription>
					<S.ProfileRingTier tier={ring.tier}>{ring.tier} Tier</S.ProfileRingTier>
				</S.ProfileRingInfo>
			</S.ProfileRingCard>
		);
	}

	// Error debouncing to prevent spam
	const errorDebounceMap = React.useRef(new Map<string, number>());

	function shouldLogError(assetId: string): boolean {
		const now = Date.now();
		const lastLogged = errorDebounceMap.current.get(assetId) || 0;
		if (now - lastLogged > 5000) {
			// Only log once every 5 seconds per asset
			errorDebounceMap.current.set(assetId, now);
			return true;
		}
		return false;
	}

	// Component to handle different media types for Campaign 2 assets
	function getAssetMedia(asset: (typeof campaign2Assets)[0]) {
		// Check if we have a valid asset ID/cover before creating src
		const assetId = asset.claimed ? asset.id : asset.cover;
		if (!assetId || assetId === 'undefined') {
			// Return a placeholder for invalid assets
			return (
				<div
					style={{
						borderRadius: '8px',
						width: '100%',
						height: '100%',
						backgroundColor: '#374151',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						color: '#9ca3af',
						fontSize: '12px',
						border: '2px solid #595959',
					}}
				>
					Asset Loading...
				</div>
			);
		}

		const src = getTxEndpoint(assetId);
		const style = {
			borderRadius: '8px',
			width: '100%',
			height: '100%',
			objectFit: 'cover' as const,
			border: asset.claimable ? '2px solid #1fd014' : asset.claimed ? '2px solid #10b981' : '2px solid #595959',
			boxShadow: asset.claimable
				? '0px 0px 10px 2px #5AF650'
				: asset.claimed
				? '0 0 5px 2px #10b981'
				: '0 0 5px 2px #595959',
		};

		const handleError = (e: any) => {
			// Prevent infinite loop by checking if we're already showing fallback
			if (e.currentTarget.src.includes('logo')) {
				return;
			}
			// Debounced error logging
			if (shouldLogError(assetId)) {
				console.warn(`Failed to load media for ${asset.title}, using fallback`);
			}
			// Set fallback image only once
			e.currentTarget.src = ASSETS.logo;
		};

		// Check if it's a video (either from contentType or heuristics)
		// For Campaign 2, the main asset (Platinum DumDum) is typically a video
		const isVideo =
			(asset.contentType && asset.contentType.includes('video')) ||
			(asset.isMainAsset && asset.title.includes('Platinum'));

		if (isVideo) {
			return <video src={src} style={style} muted autoPlay loop onError={handleError} />;
		}

		// Default to image for everything else
		return <img src={src} alt={asset.title} style={style} onError={handleError} />;
	}

	function getCampaign2AssetCard(asset: (typeof campaign2Assets)[0]) {
		return (
			<S.ProfileRingCard key={asset.id}>
				<S.ProfileRingPreview>
					<S.ProfileRingAvatar>
						{/* Show actual asset media from Campaign 2 (DumDum Trials) - handles images, videos, etc. */}
						{getAssetMedia(asset)}
					</S.ProfileRingAvatar>
					<S.ProfileRingActive isActive={asset.claimed}>
						{asset.claimed ? 'CLAIMED' : asset.claimable ? 'CLAIMABLE' : 'LOCKED'}
					</S.ProfileRingActive>
				</S.ProfileRingPreview>
				<S.ProfileRingInfo>
					<S.ProfileRingName>{asset.title}</S.ProfileRingName>
					<S.ProfileRingDescription>{asset.description}</S.ProfileRingDescription>
					<S.ProfileRingTier tier="Core">{asset.isMainAsset ? 'Platinum DumDum' : 'DumDum Trials'}</S.ProfileRingTier>
					{asset.claimable && !asset.claimed && (
						<button
							onClick={() => handleClaimCampaign2Asset(asset.id)}
							disabled={asset.claimInProgress}
							style={{
								marginTop: '12px',
								padding: '8px 16px',
								background: '#10b981',
								color: 'white',
								border: 'none',
								borderRadius: '8px',
								cursor: asset.claimInProgress ? 'not-allowed' : 'pointer',
								fontSize: '14px',
								fontWeight: 'bold',
							}}
						>
							{asset.claimInProgress ? 'Claiming...' : 'Claim Asset'}
						</button>
					)}
					{asset.claimed && (
						<button
							style={{
								marginTop: '12px',
								padding: '8px 16px',
								background: '#6b7280',
								color: 'white',
								border: 'none',
								borderRadius: '8px',
								cursor: 'pointer',
								fontSize: '14px',
								fontWeight: 'bold',
							}}
							onClick={() => window.open(`${URLS.asset}${asset.id}`, '_blank')}
						>
							View Asset
						</button>
					)}
				</S.ProfileRingInfo>
			</S.ProfileRingCard>
		);
	}

	// Helper function to format Wander balance for human readability
	const formatWanderBalance = (balance: string) => {
		const num = parseFloat(balance);
		if (num >= 1e9) {
			return (num / 1e9).toFixed(2) + 'B';
		} else if (num >= 1e6) {
			return (num / 1e6).toFixed(2) + 'M';
		} else if (num >= 1e3) {
			return (num / 1e3).toFixed(1) + 'K';
		} else {
			return num.toLocaleString();
		}
	};

	const subheader = React.useMemo(() => {
		let label: string;
		let action = null;

		if (!arProvider.walletAddress) {
			label = language.connectWallet;
			action = () => arProvider.setWalletModalVisible(true);
		} else {
			if (permawebProvider.profile) {
				if (permawebProvider.profile.id) {
					label = permawebProvider.profile.username;
				} else {
					label = language.createProfile;
					action = () => setShowProfileManage(true);
				}
			} else label = formatAddress(arProvider.walletAddress, false);
		}

		const active = arProvider.walletAddress !== null;

		return (
			<S.Subheader>
				<p>
					Complete quests to earn WNDR tokens and exclusive colored profile rings! Each quest tier offers increasing
					rewards. Start your journey by creating a profile and exploring the atomic asset ecosystem.
					{wanderTierInfo && (
						<>
							<br />
							<strong>Your Wander</strong>
							{wanderTierInfo.rank && wanderTierInfo.rank !== '' && <> • Rank: #{wanderTierInfo.rank}</>}
							{wanderTierInfo.balance && <> • Balance: {formatWanderBalance(wanderTierInfo.balance)} WNDR</>}
							<br />
							<strong>Tier: {wanderTierInfo.tier}</strong>
						</>
					)}
				</p>
				<S.ProfileWrapper onClick={action} active={active}>
					<span>{label}</span>
				</S.ProfileWrapper>
			</S.Subheader>
		);
	}, [permawebProvider.profile, arProvider.walletAddress, language, wanderTierInfo]);

	const notification = React.useMemo(() => {
		if (claimNotification) {
			const quest = quests.find((q) => q.id === claimNotification.questId);
			const isCampaignComplete = claimNotification.reward.campaignComplete;

			return (
				<Modal header={null} handleClose={() => setClaimNotification(null)}>
					<S.MWrapper>
						<S.MContentWrapper>
							<S.AssetTextWrapper>
								<p>Congratulations!</p>
								{isCampaignComplete ? (
									<>
										<span>🎉 Wander Campaign Completed!</span>
										<span>All quests have been finished!</span>
									</>
								) : (
									<>
										<span>You've completed</span>
										<span>{quest?.title}</span>
									</>
								)}
							</S.AssetTextWrapper>
							{!isCampaignComplete && (
								<S.RewardDisplay>
									<S.RewardItem>
										<span>{claimNotification.reward.wndr} WNDR</span>
									</S.RewardItem>
									{claimNotification.reward.profileRing && (
										<S.RewardItem>
											<span>Profile Ring Unlocked!</span>
										</S.RewardItem>
									)}
								</S.RewardDisplay>
							)}
							{isCampaignComplete && (
								<S.CampaignRewardDisplay>
									<S.CampaignRewardText>🚀 Tier advancement request submitted to Wander team!</S.CampaignRewardText>
									{wanderTierInfo && (
										<S.CampaignCurrentTier>
											Current Tier: <strong>{wanderTierInfo.tier}</strong>
										</S.CampaignCurrentTier>
									)}
								</S.CampaignRewardDisplay>
							)}
						</S.MContentWrapper>
						<S.MActionWrapper>
							<button onClick={() => setClaimNotification(null)}>Close</button>
						</S.MActionWrapper>
					</S.MWrapper>
				</Modal>
			);
		}
		return null;
	}, [claimNotification, quests]);

	// Force refresh Campaign 2 cache
	function forceRefreshCampaign2Cache() {
		console.log('Force refreshing Campaign 2 cache...');
		// Clear all Campaign 2 related cache
		localStorage.removeItem(DRIVE_CONFIG_KEY);
		localStorage.removeItem(BRIDGE_DRIVE_VERSION_KEY);
		localStorage.removeItem('drive-config'); // Old Campaign 1 cache

		// Reload assets
		setCampaign2Assets([]);
		loadCampaign2Assets();
	}

	// Debug function to manually complete quests based on current status
	function forceCompleteEligibleQuests() {
		console.log('Force completing eligible quests...');
		console.log('Current progress:', progress);
		console.log('Profile provider:', permawebProvider.profile);
		console.log('AR provider:', arProvider.walletAddress);
		console.log('Quests state:', quests);

		// Force complete based on what we can detect directly

		// Profile quest - if we have a profile connected, complete it
		if (permawebProvider.profile?.id && !quests.find((q) => q.id === 'create-profile')?.isCompleted) {
			console.log('Force completing create-profile quest');
			dispatch(completeQuest('create-profile'));
		}

		// Use progress data for other quests
		if (progress.firstAssetCreated && !quests.find((q) => q.id === 'create-asset')?.isCompleted) {
			dispatch(completeQuest('create-asset'));
		}
		if (progress.firstCollectionCreated && !quests.find((q) => q.id === 'create-collection')?.isCompleted) {
			dispatch(completeQuest('create-collection'));
		}
		if (progress.firstPurchaseMade && !quests.find((q) => q.id === 'make-purchase')?.isCompleted) {
			dispatch(completeQuest('make-purchase'));
		}
		if (progress.pixelDelegated && !quests.find((q) => q.id === 'delegate-pixl')?.isCompleted) {
			dispatch(completeQuest('delegate-pixl'));
		}
	}

	// Auto-complete profile quest immediately when profile is available
	React.useEffect(() => {
		if (ENABLE_QUEST_SYSTEM && permawebProvider.profile?.id && quests.length > 0) {
			const profileQuest = quests.find((q) => q.id === 'create-profile');
			if (profileQuest && !profileQuest.isCompleted) {
				console.log('Auto-completing profile quest for existing user');
				dispatch(completeQuest('create-profile'));
			}
		}
	}, [permawebProvider.profile?.id, quests.length, dispatch]);

	function getView() {
		return (
			<>
				<S.Wrapper className={'border-wrapper-alt2 fade-in'}>
					<S.Header>
						<S.HeaderMain>
							<h1>Wander Tier Quest</h1>
							{process.env.NODE_ENV === 'development' && (
								<>
									<button
										onClick={forceCompleteEligibleQuests}
										style={{
											padding: '8px 16px',
											background: '#10b981',
											color: 'white',
											border: 'none',
											borderRadius: '8px',
											cursor: 'pointer',
											fontSize: '12px',
											marginLeft: '16px',
										}}
									>
										Debug: Complete Eligible Quests
									</button>
									<button
										onClick={forceRefreshCampaign2Cache}
										style={{
											padding: '8px 16px',
											background: '#f59e0b',
											color: 'white',
											border: 'none',
											borderRadius: '8px',
											cursor: 'pointer',
											fontSize: '12px',
											marginLeft: '8px',
										}}
									>
										Force Refresh Assets
									</button>
									<button
										onClick={() => {
											questTracker.clearCache();
											// Force re-fetch quest progress
											if (permawebProvider.profile?.id) {
												questTracker
													.getQuestProgress(permawebProvider.profile.id, arProvider.walletAddress)
													.then((newProgress) => {
														console.log('Fresh quest progress:', newProgress);
													});
											}
										}}
										style={{
											padding: '8px 16px',
											background: '#8b5cf6',
											color: 'white',
											border: 'none',
											borderRadius: '8px',
											cursor: 'pointer',
											fontSize: '12px',
											marginLeft: '8px',
										}}
									>
										Clear Cache & Refresh
									</button>
									<button
										onClick={async () => {
											if (permawebProvider.profile?.id) {
												console.log('🔍 DEBUGGING PURCHASE DETECTION...');
												console.log('Using profile ID:', permawebProvider.profile.id);

												// Directly call hasMadePurchase to see debug output
												const result = await (questTracker as any).hasMadePurchase(permawebProvider.profile.id);
												console.log('🎯 Direct purchase detection result:', result);
											}
										}}
										style={{
											padding: '8px 16px',
											background: '#f59e0b',
											color: 'white',
											border: 'none',
											borderRadius: '8px',
											cursor: 'pointer',
											fontSize: '12px',
											marginLeft: '8px',
										}}
									>
										Debug Purchase Detection
									</button>
									<button
										onClick={async () => {
											if (permawebProvider.profile?.id) {
												console.log('🎨 DEBUGGING ASSET CREATION DETECTION...');
												console.log('Using profile ID:', permawebProvider.profile.id);
												console.log('Using wallet address:', arProvider.walletAddress);

												// Directly call getQuestProgress to see asset detection debug output
												const progress = await questTracker.getQuestProgress(
													permawebProvider.profile.id,
													arProvider.walletAddress
												);
												console.log('🎯 Asset detection in progress:', {
													totalAssets: progress.totalAssets,
													firstAssetCreated: progress.firstAssetCreated,
												});
											}
										}}
										style={{
											padding: '8px 16px',
											background: '#10b981',
											color: 'white',
											border: 'none',
											borderRadius: '8px',
											cursor: 'pointer',
											fontSize: '12px',
											marginLeft: '8px',
										}}
									>
										Debug Asset Creation
									</button>
									<button
										onClick={async () => {
											console.log('💎 DEBUGGING PIXL DELEGATION DETECTION...');
											console.log('Using wallet address:', arProvider.walletAddress);

											// Directly call hasPixelDelegation to see debug output
											const result = await (questTracker as any).hasPixelDelegation(arProvider.walletAddress);
											console.log('🎯 Direct PIXL delegation detection result:', result);
										}}
										style={{
											padding: '8px 16px',
											background: '#8b5cf6',
											color: 'white',
											border: 'none',
											borderRadius: '8px',
											cursor: 'pointer',
											fontSize: '12px',
											marginLeft: '8px',
										}}
									>
										Debug PIXL Delegation
									</button>
									<button
										onClick={async () => {
											console.log('🔄 RESETTING QUEST STATE & FORCING FRESH DATA...');

											// Clear quest tracker cache
											questTracker.clearCache();

											// Reset Redux quest state to initial
											const initialQuests: Quest[] = Object.values(QUEST_CONFIG).map((config) => ({
												...config,
												completed: 0,
												isCompleted: false,
												isClaimed: false,
											}));
											dispatch(setQuests(initialQuests));

											// Force fresh quest progress check
											await checkQuestProgress();

											console.log('🎯 Quest state reset complete');
										}}
										style={{
											padding: '8px 16px',
											background: '#dc2626',
											color: 'white',
											border: 'none',
											borderRadius: '8px',
											cursor: 'pointer',
											fontSize: '12px',
											marginLeft: '8px',
										}}
									>
										Reset Quest State
									</button>
								</>
							)}
						</S.HeaderMain>
						{subheader}
					</S.Header>

					<S.Body>
						{campaignCompleted && (
							<S.CampaignCompleteBanner className={'fade-in'}>
								<S.CampaignCompleteContent>
									<h3>🎉 Wander Campaign Completed!</h3>
									<p>
										Congratulations! You've completed all campaign quests.
										{tierAdvancementAttempted
											? ' Tier advancement has been requested!'
											: ' Processing tier advancement...'}
									</p>
									{wanderTierInfo && (
										<S.CurrentTierInfo>
											Current Tier: <strong>{wanderTierInfo.tier}</strong>
											{wanderTierInfo.balance && (
												<> • Balance: {parseFloat(wanderTierInfo.balance).toLocaleString()} WNDR</>
											)}
										</S.CurrentTierInfo>
									)}
								</S.CampaignCompleteContent>
							</S.CampaignCompleteBanner>
						)}

						<S.QuestsGrid>{quests.map((quest) => getQuestCard(quest))}</S.QuestsGrid>

						{earnedProfileRings.length > 0 && (
							<S.ProfileRingsSection>
								<S.ProfileRingsHeader>
									<h2>🎯 Earned Wander Profile Rings</h2>
									<p>Your colored profile rings show your achievements in the Wander ecosystem!</p>
									{currentProfileRing && (
										<S.CurrentRingIndicator>
											Current Active Ring:{' '}
											<strong>
												{WANDER_PROFILE_RINGS[currentProfileRing as keyof typeof WANDER_PROFILE_RINGS]?.name}
											</strong>
										</S.CurrentRingIndicator>
									)}
								</S.ProfileRingsHeader>
								<S.ProfileRingsGrid>
									{earnedProfileRings.map((ringId) => getProfileRingCard(ringId))}
								</S.ProfileRingsGrid>
							</S.ProfileRingsSection>
						)}

						{(campaign2Loading || campaign2Assets.length > 0) && (
							<S.ProfileRingsSection>
								<S.ProfileRingsHeader>
									<h2>DumDum Trials Atomic Assets</h2>
									<p>
										Claim exclusive DumDum Trials atomic assets as you complete Wander quests - these are rare
										collectible DumDums stored permanently on Arweave!
									</p>
								</S.ProfileRingsHeader>
								{campaign2Loading ? (
									<div
										style={{
											display: 'flex',
											justifyContent: 'center',
											alignItems: 'center',
											padding: '40px',
											color: 'var(--text-secondary)',
											fontSize: '1.1rem',
										}}
									>
										Loading DumDum Trials assets...
									</div>
								) : (
									<S.ProfileRingsGrid>
										{campaign2Assets.map((asset) => getCampaign2AssetCard(asset))}
									</S.ProfileRingsGrid>
								)}
							</S.ProfileRingsSection>
						)}
					</S.Body>

					<S.Footer>
						<p>Quest Rules</p>
						<br />
						<p>
							Complete one or more tasks to earn rewards. Rewards include WNDR tokens and exclusive colored profile
							rings that increase by tier. All quests must be completed with the same wallet address. Rewards are
							distributed automatically upon claiming.
						</p>
						<br />
						<p>
							Bronze Tier: Basic profile and asset creation
							<br />
							Silver Tier: Collection creation and asset management
							<br />
							Gold Tier: Marketplace participation and purchases
							<br />
							Platinum Tier: Advanced features like staking
						</p>
						<br />
						<p>
							<strong>Powered by Wander Team</strong> - Earn WNDR tokens and exclusive profile rings based on your
							Wander tier!
						</p>
					</S.Footer>
				</S.Wrapper>

				{showProfileManage && (
					<Panel
						open={showProfileManage}
						header={
							permawebProvider.profile && permawebProvider.profile.id
								? language.editProfile
								: `${language.createProfile}!`
						}
						handleClose={() => setShowProfileManage(false)}
					>
						<S.PManageWrapper>
							<ProfileManage
								profile={permawebProvider.profile && permawebProvider.profile.id ? permawebProvider.profile : null}
								handleClose={() => setShowProfileManage(false)}
								handleUpdate={null}
							/>
						</S.PManageWrapper>
					</Panel>
				)}

				{claimNotification && notification}
			</>
		);
	}

	return getView();
}
