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
	getProfileRingForTier,
	getTierMultiplier,
	getTierQuestDescription,
	WANDER_PROFILE_RINGS,
} from 'helpers/wanderTier';
import { formatWanderBalance, getWanderTierBadge, getWanderTierIcon } from 'helpers/wanderTierBadges';
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
			description: '10 WNDR',
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
			description: '25 WNDR',
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
			description: '50 WNDR',
		},
	},
	delegatePixl: {
		id: 'delegate-pixl',
		title: 'Delegate to PIXL',
		description: 'Delegate at least 10% voting power to PIXL',
		icon: ASSETS.star,
		required: 1,
		tier: 'platinum' as const,
		reward: {
			wndr: 100,
			description: '100 WNDR',
		},
	},
};

// Performance optimization: Add request caching and deduplication
const requestCache = new Map<string, { data: any; timestamp: number; error?: boolean }>();
const CACHE_DURATION = 30000; // 30 seconds cache
const ERROR_CACHE_DURATION = 60000; // 1 minute for failed requests

// Debounce function for API calls
function debounce(func: Function, wait: number) {
	let timeout: NodeJS.Timeout;
	return function executedFunction(...args: any[]) {
		const later = () => {
			clearTimeout(timeout);
			func(...args);
		};
		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
	};
}

// Cached API call wrapper with error handling
async function cachedApiCall(key: string, apiCall: () => Promise<any>) {
	const cached = requestCache.get(key);
	const now = Date.now();

	// Check if we have a cached result
	if (cached) {
		const cacheAge = now - cached.timestamp;
		const maxAge = cached.error ? ERROR_CACHE_DURATION : CACHE_DURATION;

		if (cacheAge < maxAge) {
			return cached.data;
		}
	}

	try {
		const data = await apiCall();
		requestCache.set(key, { data, timestamp: now, error: false });
		return data;
	} catch (error) {
		// Cache failed requests to prevent repeated failures
		requestCache.set(key, { data: null, timestamp: now, error: true });
		throw error;
	}
}

// MOVED OUTSIDE COMPONENT: Quest utility functions to prevent re-creation
function getQuestProgress(questId: string, quests: Quest[]): number {
	const quest = quests.find((q) => q.id === questId);
	return quest?.isCompleted ? 1 : 0;
}

function isQuestCompleted(questId: string, quests: Quest[]): boolean {
	const quest = quests.find((q) => q.id === questId);
	return quest?.isCompleted || false;
}

export default function Quests() {
	const navigate = useNavigate();
	const dispatch = useDispatch();

	const permawebProvider = usePermawebProvider();
	const arProvider = useArweaveProvider();
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const questsState = useSelector((state: RootState) => state.questsReducer);
	const { quests, progress } = questsState;

	// REMOVED: Debug logging on every render - causes 3000+ messages
	// Only log once when component mounts or when quest completion actually changes
	const totalQuests = quests.length;
	const completedQuests = quests.filter((quest) => quest.isCompleted).length;
	const claimedQuests = quests.filter((quest) => quest.isClaimed).length;

	const [showProfileManage, setShowProfileManage] = React.useState<boolean>(false);
	const [profileCreationInProgress, setProfileCreationInProgress] = React.useState<boolean>(false);
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
	const [questDataLoading, setQuestDataLoading] = React.useState<boolean>(false);
	const [profileLoading, setProfileLoading] = React.useState<boolean>(false);

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

	// ULTRA-OPTIMIZED: Synchronous first-paint data loading
	React.useEffect(() => {
		if (!ENABLE_QUEST_SYSTEM || !arProvider.walletAddress) return;

		console.log('Profile loading check:', {
			hasProfile: !!permawebProvider.profile,
			hasLibs: !!permawebProvider.libs,
			profileId: permawebProvider.profile?.id,
			walletAddress: arProvider.walletAddress,
		});

		// Wait for profile to be available before proceeding
		if (!permawebProvider.profile && !permawebProvider.libs) {
			console.log('⏳ Waiting for profile data to load...');
			setProfileLoading(true);
			return;
		}

		// Profile is available, proceed with quest verification
		setProfileLoading(false);

		// console.log('Quests - Starting ULTRA-OPTIMIZED data fetch...');

		// Single function to fetch ALL data synchronously for first paint
		const fetchAllDataSynchronously = async () => {
			setQuestDataLoading(true);
			try {
				// STEP 1: SIMPLIFIED Profile Check (like Campaign_2)

				// Use the same simple approach as Campaign_2
				const profileData = {
					id: permawebProvider.profile?.id || null,
					profileType: permawebProvider.profile?.id ? 'active' : 'none',
					isLegacyProfile: permawebProvider.profile?.isLegacyProfile || false,
				};

				console.log('Profile data check:', profileData);

				// Profile verification result
				if (!profileData?.id) {
					console.log('❌ No Bazar profile found - Quest system requires a profile');
					// Still update quest progress to show "Create Profile" quest
					const noProfileProgress = {
						profileCreated: false,
						firstAssetCreated: false,
						firstCollectionCreated: false,
						firstPurchaseMade: false,
						pixelDelegated: false,
						totalAssets: 0,
						totalCollections: 0,
						totalPurchases: 0,
					};
					dispatch(updateQuestProgress(noProfileProgress));
					return;
				}

				// Update quest progress to reflect profile status (simplified)
				const profileStatus = {
					profileCreated: !!profileData.id,
					hasLegacyProfile: profileData.isLegacyProfile,
					needsMigration: false, // Simplified approach like Campaign_2
				};

				// console.log('📊 Profile status for quests:', profileStatus);

				// console.log('✅ Bazar profile verified successfully:', {
				// 	profileId: profileData.id,
				// 	profileType: profileData.profileType,
				// 	isLegacy: profileData.isLegacyProfile
				// });

				// STEP 2: Get quest progress with IMMEDIATE first paint data
				const progressKey = `progress-${profileData.id}-${arProvider.walletAddress}`;
				const freshProgress = await cachedApiCall(progressKey, async () => {
					// Use preload for immediate data, then get full data
					const immediateData = await questTracker.preloadQuestData(profileData.id, arProvider.walletAddress);
					const fullData = await questTracker.getQuestProgress(profileData.id, arProvider.walletAddress);
					return fullData;
				});

				// STEP 3: Update ALL Redux state IMMEDIATELY for first paint
				dispatch(updateQuestProgress(freshProgress));

				// STEP 4: Auto-complete quests IMMEDIATELY based on profile verification
				const questUpdates = [];

				// Profile creation quest completion - SIMPLIFIED (like Campaign_2)
				// console.log('🔍 Profile verification for quest completion:', {
				// 	profileId: profileData.id,
				// 	profileType: profileData.profileType,
				// 	isLegacy: profileData.isLegacyProfile
				// });

				// Simple check: if user has a profile, auto-complete quests (like Campaign_2)
				if (profileData.id) {
					console.log('✅ Profile found, auto-completing create-profile quest');
					questUpdates.push('create-profile');
					// Auto-complete Bronze DumDum (Wander wallet) and Silver DumDum (Profile creation)
					questUpdates.push('create-asset'); // Bronze DumDum - Having Wander wallet
					questUpdates.push('create-collection'); // Silver DumDum - Create profile on Bazar
				} else {
					console.log('❌ "Create Profile" quest not completed - No profile found');
				}
				if (freshProgress.firstAssetCreated) {
					questUpdates.push('create-asset');
				}
				if (freshProgress.firstCollectionCreated) {
					questUpdates.push('create-collection');
				}
				if (freshProgress.firstPurchaseMade) {
					questUpdates.push('make-purchase');
				}
				if (freshProgress.pixelDelegated && freshProgress.hasStampedSilverDumDum) {
					questUpdates.push('delegate-pixl');
				}

				// Batch dispatch ALL quest completions at once
				// console.log('🎯 Quest updates to dispatch:', questUpdates);
				questUpdates.forEach((questId) => {
					const existingQuest = quests.find((q) => q.id === questId);
					if (!existingQuest?.isCompleted) {
						// console.log(`✅ Dispatching quest completion: ${questId}`);
						dispatch(completeQuest(questId));
					} else {
						// console.log(`⏭️ Skipping already completed quest: ${questId}`);
					}
				});

				// Debug: Log current quest completion status
				// console.log('🔍 Current quest completion status:', {
				// 	createProfile: quests.find(q => q.id === 'create-profile')?.isCompleted,
				// 	createAsset: quests.find(q => q.id === 'create-asset')?.isCompleted,
				// 	createCollection: quests.find(q => q.id === 'create-collection')?.isCompleted,
				// 	totalQuests: quests.length,
				// 	completedQuests: quests.filter(q => q.isCompleted).length,
				// 	allQuests: quests.map(q => ({ id: q.id, isCompleted: q.isCompleted }))
				// });

				// STEP 5: Update Wander tier info IMMEDIATELY
				if (freshProgress.wanderTier) {
					setWanderTierInfo({
						tier: freshProgress.wanderTier,
						balance: freshProgress.wanderBalance,
						rank: freshProgress.wanderRank,
					});
				}

				// STEP 6: Check campaign completion (cached, fast)
				const campaignKey = `campaign-${profileData.id}`;
				const campaignCompleted = await cachedApiCall(campaignKey, () =>
					questTracker.hasCompletedWanderCampaign(profileData.id)
				);
				setCampaignCompleted(campaignCompleted);

				// STEP 6.5: Trigger Bronze DumDum claiming if all quests are completed
				if (campaignCompleted) {
					setTimeout(() => {
						autoClaimBronzeDumDum();
					}, 1000); // Small delay to ensure quest completion is processed
				}

				// STEP 7: Check delegation status (cached, fast)
				const delegationKey = `delegation-${arProvider.walletAddress}`;
				await cachedApiCall(delegationKey, async () => {
					if (typeof getDelegations === 'function') {
						await questTracker.trackPixelDelegation(arProvider.walletAddress);
					}
				});

				// console.log('Quests - ULTRA-OPTIMIZED: All data loaded synchronously for first paint');
			} catch (error) {
				console.error('Error in ultra-optimized quest data fetch:', error);
			} finally {
				setQuestDataLoading(false);
			}
		};

		// IMMEDIATE fetch for first paint
		fetchAllDataSynchronously();

		// Debounced refresh for subsequent updates
		const debouncedRefresh = debounce(fetchAllDataSynchronously, 1000);

		// AGGRESSIVE ERROR HANDLING: Reduced retry attempts to prevent server overload
		let profileRetryCount = 0;
		const maxProfileRetries = 3; // Reduced from 10 to 3 to prevent server spam

		const profileRetryInterval = setInterval(() => {
			if (!permawebProvider.profile && !permawebProvider.libs && profileRetryCount < maxProfileRetries) {
				profileRetryCount++;
				// console.log(`⏳ Profile loading retry ${profileRetryCount}/${maxProfileRetries}...`);
				return;
			}

			if (permawebProvider.profile || permawebProvider.libs) {
				// console.log('✅ Profile data available, proceeding with quest verification');
				clearInterval(profileRetryInterval);
				fetchAllDataSynchronously();
			} else if (profileRetryCount >= maxProfileRetries) {
				// console.log('❌ Profile loading timeout - using fallback data to prevent server overload');
				clearInterval(profileRetryInterval);
				setProfileLoading(false);

				// Use fallback data instead of failing completely
				const fallbackProgress = {
					profileCreated: false,
					firstAssetCreated: false,
					firstCollectionCreated: false,
					firstPurchaseMade: false,
					pixelDelegated: false,
					totalAssets: 0,
					totalCollections: 0,
					totalPurchases: 0,
				};
				dispatch(updateQuestProgress(fallbackProgress));
			}
		}, 2000); // Increased from 1 second to 2 seconds to reduce server load

		// Set up interval for periodic updates (AGGRESSIVELY REDUCED frequency to prevent server overload)
		const interval = setInterval(() => {
			// Only clear successful cache entries, keep error cache to prevent repeated failures
			const now = Date.now();
			for (const [key, value] of requestCache.entries()) {
				const cacheAge = now - value.timestamp;
				const maxAge = value.error ? ERROR_CACHE_DURATION : CACHE_DURATION;
				if (cacheAge >= maxAge) {
					requestCache.delete(key);
				}
			}

			// Only refresh if we haven't had recent errors
			const recentErrors = Array.from(requestCache.values()).filter((v) => v.error && now - v.timestamp < 60000).length;
			if (recentErrors < 3) {
				debouncedRefresh();
			} else {
				// console.log('⚠️ Skipping periodic refresh due to recent errors - preventing server overload');
			}
		}, 600000); // Increased from 5 minutes to 10 minutes to reduce server load

		return () => {
			clearInterval(interval);
			clearInterval(profileRetryInterval);
		};
	}, [arProvider.walletAddress, permawebProvider.profile?.id]); // REMOVED quests dependency - was causing infinite loop

	// OPTIMIZED: Load Campaign 2 assets once on mount
	React.useEffect(() => {
		if (!ENABLE_QUEST_SYSTEM || campaign2Assets.length > 0) return;

		const loadAssets = async () => {
			setCampaign2Loading(true);
			try {
				await loadCampaign2Assets();
			} catch (error) {
				// console.log('Campaign 2 asset loading failed:', error);
			} finally {
				setCampaign2Loading(false);
			}
		};

		loadAssets();
	}, []);

	// OPTIMIZED: Check Campaign 2 claim status only when necessary - REDUCED FREQUENCY
	React.useEffect(() => {
		if (
			!ENABLE_QUEST_SYSTEM ||
			!arProvider.walletAddress ||
			!permawebProvider.profile ||
			campaign2Assets.length === 0 ||
			quests.length === 0
		)
			return;

		// Heavily debounced claim status check to prevent excessive API calls
		const debouncedClaimCheck = debounce(async () => {
			try {
				await checkCampaign2ClaimStatus();
			} catch (error) {
				// Silently fail to prevent console spam
			}
		}, 10000); // Increased from 2 seconds to 10 seconds

		debouncedClaimCheck();
	}, [arProvider.walletAddress, permawebProvider.profile?.id, campaign2Assets.length]); // REMOVED quests.length dependency

	// OPTIMIZED: Update quests with tier rewards (no API calls)
	React.useEffect(() => {
		if (wanderTierInfo && quests.length > 0) {
			updateQuestsWithTierRewards();
		}
	}, [wanderTierInfo, quests.length]);

	// Force refresh quests on mount to ensure clean state
	React.useEffect(() => {
		// Clear quests and force refresh to remove any old ring descriptions
		dispatch(setQuests([]));
		const timer = setTimeout(() => {
			if (wanderTierInfo) {
				updateQuestsWithTierRewards();
			}
		}, 100);
		return () => clearTimeout(timer);
	}, []);

	// Check campaign completion status - REDUCED FREQUENCY
	React.useEffect(() => {
		if (arProvider.walletAddress && completedQuests >= 5) {
			// Only check when all quests might be completed
			const debouncedCampaignCheck = debounce(checkCampaignCompletion, 5000); // 5 second debounce
			debouncedCampaignCheck();
		}
	}, [completedQuests, arProvider.walletAddress]); // SIMPLIFIED dependencies

	// Reset profile creation state when profile is successfully detected
	React.useEffect(() => {
		if (profileCreationInProgress && permawebProvider.profile?.id) {
			// console.log('✅ Profile created successfully, resetting creation state');
			setProfileCreationInProgress(false);
		}
	}, [permawebProvider.profile?.id, profileCreationInProgress]);

	// Auto-reset profile creation state after timeout (fallback)
	React.useEffect(() => {
		if (profileCreationInProgress) {
			const timeout = setTimeout(() => {
				// console.log('⏰ Profile creation timeout, resetting state');
				setProfileCreationInProgress(false);
			}, 30000); // 30 seconds timeout

			return () => clearTimeout(timeout);
		}
	}, [profileCreationInProgress]);

	// Auto-claim Bronze DumDum when all quests are completed
	async function autoClaimBronzeDumDum() {
		if (!arProvider.walletAddress || !permawebProvider.profile?.id) {
			return;
		}

		// Check if all quests are completed
		const allQuestsCompleted = quests.every((quest) => quest.isCompleted);

		if (!allQuestsCompleted) {
			return; // Only claim when all quests are done
		}

		try {
			// Find Bronze DumDum asset (GridPlacement '1')
			const bronzeDumDum = campaign2Assets.find(
				(asset) => asset.questRequirement === 'create-asset' && asset.requirementType === 'wander'
			);

			if (!bronzeDumDum) {
				return;
			}

			// Try direct AO call first, then fallback to dryrun
			try {
				const tags = [
					{ name: 'Address', value: arProvider.walletAddress },
					{ name: 'ProfileId', value: permawebProvider.profile.id },
				];

				// Check if already claimed
				const statusResponse = await messageResult({
					processId: bronzeDumDum.id,
					wallet: arProvider.wallet,
					action: 'Get-Claim-Status',
					tags: tags,
					data: null,
				});

				if (
					statusResponse &&
					statusResponse['Claim-Status-Response'] &&
					statusResponse['Claim-Status-Response'].status === 'Claimed'
				) {
					// Already claimed, update UI state
					setCampaign2Assets((prevAssets) =>
						prevAssets.map((asset) =>
							asset.id === bronzeDumDum.id ? { ...asset, claimable: false, claimed: true } : asset
						)
					);
				} else {
					// Attempt to claim Bronze DumDum
					const response = await messageResult({
						processId: bronzeDumDum.id,
						wallet: arProvider.wallet,
						action: 'Handle-Claim',
						tags: tags,
						data: null,
					});

					if (response && response['Claim-Status-Response'] && response['Claim-Status-Response'].status === 'Claimed') {
						// Successfully claimed, update UI state
						setCampaign2Assets((prevAssets) =>
							prevAssets.map((asset) =>
								asset.id === bronzeDumDum.id ? { ...asset, claimable: false, claimed: true } : asset
							)
						);
					}
				}
			} catch (aoError) {
				// Fallback: Use permaweb-libs dryrun
				try {
					await permawebProvider.libs?.dryrun({
						processId: bronzeDumDum.id,
						action: 'Handle-Claim',
						tags: [
							{ name: 'Address', value: arProvider.walletAddress },
							{ name: 'ProfileId', value: permawebProvider.profile.id },
						],
						data: null,
					});
				} catch (dryrunError) {
					// Silent error handling
				}
			}
		} catch (error) {
			// Silent error handling
		}
	}

	async function checkQuestProgress() {
		if (!arProvider.walletAddress) return;

		// console.log('Quests - checkQuestProgress called with:', {
		// 	walletAddress: arProvider.walletAddress,
		// 	permawebProfileId: permawebProvider.profile?.id,
		// 	isLegacyProfile: permawebProvider.profile?.isLegacyProfile,
		// });

		// ALWAYS try to fetch the HyperBeam zone profile first, since legacy profiles are deprecated
		// console.log('Quests - Attempting to fetch HyperBeam zone profile directly...');
		let profileIdToUse = null;

		try {
			// Always try to get the zone profile first (HyperBeam profiles)
			const zoneProfile = await permawebProvider.libs?.getProfileByWalletAddress(arProvider.walletAddress);
			if (zoneProfile?.id) {
				// console.log('Quests - ✅ Found HyperBeam zone profile ID:', zoneProfile.id);
				// console.log('Quests - Zone profile type:', zoneProfile.isLegacyProfile ? 'Legacy' : 'HyperBeam');
				profileIdToUse = zoneProfile.id;
			} else {
				// console.log('Quests - ❌ HyperBeam zone profile not found');
			}
		} catch (error) {
			// console.log('Quests - ❌ HyperBeam zone profile fetch failed:', error);
		}

		// Only fall back to provider profile if zone profile fetch completely failed
		if (!profileIdToUse) {
			// console.log('Quests - Falling back to PermawebProvider profile ID...');
			profileIdToUse = permawebProvider.profile?.id;
			// console.log(
			// 	'Quests - Fallback profile type:',
			// 	permawebProvider.profile?.isLegacyProfile ? 'Legacy' : 'HyperBeam'
			// );
		}

		// console.log('Quests - Using profile ID for quest tracking:', profileIdToUse);
		// console.log('Quests - Current Redux progress state before update:', progress);
		// console.log('Quests - PermawebProvider profile ID:', permawebProvider.profile?.id);
		// console.log('Quests - PermawebProvider profile isLegacy:', permawebProvider.profile?.isLegacyProfile);

		// Use the quest tracker to get comprehensive progress
		const freshProgress = await questTracker.getQuestProgress(profileIdToUse, arProvider.walletAddress);
		// console.log('Quests - Fresh progress from quest tracker:', freshProgress);

		dispatch(updateQuestProgress(freshProgress));

		// Auto-complete quests based on FRESH progress data
		// console.log('Quests - Auto-completing quests based on fresh progress...');

		// Profile quest - use direct provider check as fallback
		if (freshProgress.profileCreated || permawebProvider.profile?.id) {
			if (!quests.find((q) => q.id === 'create-profile')?.isCompleted) {
				// console.log('Quests - Completing create-profile quest');
				dispatch(completeQuest('create-profile'));
			}
		}

		// Other quests based on fresh progress data
		if (freshProgress.firstAssetCreated && !quests.find((q) => q.id === 'create-asset')?.isCompleted) {
			// console.log('Quests - Completing create-asset quest');
			dispatch(completeQuest('create-asset'));
		}
		if (freshProgress.firstCollectionCreated && !quests.find((q) => q.id === 'create-collection')?.isCompleted) {
			// console.log('Quests - Completing create-collection quest');
			dispatch(completeQuest('create-collection'));
		}
		if (freshProgress.firstPurchaseMade && !quests.find((q) => q.id === 'make-purchase')?.isCompleted) {
			// console.log('Quests - Completing make-purchase quest');
			dispatch(completeQuest('make-purchase'));
		}
		if (
			freshProgress.pixelDelegated &&
			freshProgress.hasStampedSilverDumDum &&
			!quests.find((q) => q.id === 'delegate-pixl')?.isCompleted
		) {
			// console.log('Quests - Completing delegate-pixl quest (both delegation and Silver DumDum stamping completed)');
			dispatch(completeQuest('delegate-pixl'));
		}

		// Store Wander tier info for quest updates
		if (freshProgress.wanderTier) {
			// console.log('Quests - Setting Wander tier info:', freshProgress.wanderTier);
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
			// console.log('Delegation check unavailable:', error);
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
					description: `${tierRewards.wndr} WNDR`,
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

		// console.log('Quests - checkCampaignCompletion called');

		// ALWAYS try to get the HyperBeam zone profile for campaign completion
		// console.log('Quests - Fetching HyperBeam zone profile for campaign completion...');
		let profileIdToUse = null;

		try {
			const zoneProfile = await permawebProvider.libs?.getProfileByWalletAddress(arProvider.walletAddress);
			if (zoneProfile?.id) {
				profileIdToUse = zoneProfile.id;
				// console.log('Quests - ✅ Using HyperBeam zone profile for campaign completion:', profileIdToUse);
			}
		} catch (error) {
			// console.log('Quests - ❌ HyperBeam zone profile fetch failed for campaign completion:', error);
		}

		// Only fall back if zone profile fetch failed
		if (!profileIdToUse) {
			profileIdToUse = permawebProvider.profile?.id;
			// console.log('Quests - Using fallback profile for campaign completion:', profileIdToUse);
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

			// Update current profile ring to match the user's current Wander tier
			if (wanderTierInfo?.tier) {
				const ring = Object.values(WANDER_PROFILE_RINGS).find((r) => r.tier === wanderTierInfo.tier);
				if (ring) {
					setCurrentProfileRing(ring.id);
				}
			}

			return newRings;
		});

		// Store in localStorage for persistence
		const storageKey = `wander-profile-rings-${arProvider.walletAddress}`;
		const updatedRings = [...earnedProfileRings, ringId];
		localStorage.setItem(storageKey, JSON.stringify(updatedRings));
	}

	// OPTIMIZED: Campaign 2 Configuration Loading (DumDum Trials)
	async function loadCampaign2Assets() {
		// Check if already loaded
		if (campaign2Assets.length > 0) {
			// console.log('Campaign 2 assets already loaded, skipping...');
			return;
		}

		setCampaign2Loading(true);
		try {
			// Use cached API call for config loading
			const configKey = `campaign2-config-${CAMPAIGN_2_MAIN}`;
			const config = await cachedApiCall(configKey, async () => {
				let configData: any;
				const storedVersion = localStorage.getItem(BRIDGE_DRIVE_VERSION_KEY);
				const storedConfig = localStorage.getItem(DRIVE_CONFIG_KEY);

				// Clear old Campaign 1 config if it exists
				if (localStorage.getItem('drive-config')) {
					// console.log('Clearing old Campaign 1 config...');
					localStorage.removeItem('drive-config');
				}

				if (storedConfig && storedVersion === CURRENT_VERSION) {
					configData = JSON.parse(storedConfig);
					// console.log('Using stored Campaign 2 config');
				} else {
					// console.log('Loading Campaign 2 (DumDum Trials) config from process...');
					const response = await readHandler({
						processId: CAMPAIGN_2_MAIN,
						action: 'Get-Config',
					});

					localStorage.setItem(DRIVE_CONFIG_KEY, JSON.stringify(response));
					localStorage.setItem(BRIDGE_DRIVE_VERSION_KEY, CURRENT_VERSION);
					configData = response;
				}

				return configData;
			});

			if (config && config.Assets) {
				// Updated mapping to only show Bronze DumDum for all quests completion
				const questToAssetMap = [
					{ questId: 'create-asset', assetIndex: '1', requirement: 'wander' }, // Bronze DumDum - Only claimable after completing all quests
				];

				const assets = [];

				// Add main asset (Platinum DumDum)
				// console.log('Main asset config:', {
				// 	id: CAMPAIGN_2_MAIN,
				// 	name: config.Name,
				// 	cover: config.Cover,
				// 	hasValidCover: !!config.Cover && config.Cover !== 'undefined',
				// });

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
				// console.log('🏗️ Building Campaign 2 assets from config:', {
				// 	configKeys: Object.keys(config.Assets),
				// 	questToAssetMap: questToAssetMap
				// });

				Object.keys(config.Assets).forEach((key, index) => {
					const asset = config.Assets[key];
					const questMapping = questToAssetMap.find((q) => q.assetIndex === asset.GridPlacement);

					// console.log(`🔍 Campaign 2 Asset ${key}:`, {
					// 	id: asset.Id,
					// 	name: asset.Name,
					// 	cover: asset.Cover,
					// 	gridPlacement: asset.GridPlacement,
					// 	questMapping: questMapping,
					// 	questId: questMapping?.questId,
					// 	requirement: questMapping?.requirement,
					// 	index: index
					// });

					if (questMapping) {
						let description = `Bronze ${
							asset.Name || 'DumDum'
						} - Complete all quests to claim this exclusive collectible!`;

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
						// console.log(`No quest mapping found for asset with GridPlacement: ${asset.GridPlacement}`);
					}
				});

				setCampaign2Assets(assets);
				// console.log('Loaded Campaign 2 (DumDum Trials) assets:', assets);
			}
		} catch (error) {
			console.error('Error loading Campaign 2 assets:', error);
		} finally {
			setCampaign2Loading(false);
		}
	}

	// OPTIMIZED: Campaign 2 Asset Claiming Functions with better caching and fallback
	async function checkCampaign2ClaimStatus() {
		if (!arProvider.walletAddress || !permawebProvider.profile || campaign2Assets.length === 0) {
			// console.log('❌ Cannot check claim status:', {
			// 	hasWallet: !!arProvider.walletAddress,
			// 	hasProfile: !!permawebProvider.profile,
			// 	assetsCount: campaign2Assets.length,
			// 	walletAddress: arProvider.walletAddress,
			// 	profileId: permawebProvider.profile?.id
			// });
			return;
		}

		// console.log('🚀 Starting Campaign 2 claim status check...', {
		// 	walletAddress: arProvider.walletAddress,
		// 	profileId: permawebProvider.profile.id,
		// 	assetsCount: campaign2Assets.length
		// });

		// Use cached API call for claim status
		const claimStatusKey = `campaign2-claim-status-${arProvider.walletAddress}-${permawebProvider.profile.id}`;

		try {
			const updatedAssets = await cachedApiCall(claimStatusKey, async () => {
				// console.log('🔍 Checking Campaign 2 claim status for', campaign2Assets.length, 'assets');

				const results = await Promise.all(
					campaign2Assets.map(async (asset, index) => {
						// console.log(`📋 Processing asset ${index + 1}/${campaign2Assets.length}:`, {
						// 	id: asset.id,
						// 	title: asset.title,
						// 	questRequirement: asset.questRequirement,
						// 	requirementType: asset.requirementType
						// });

						const tags = [
							{ name: 'Address', value: arProvider.walletAddress },
							{ name: 'ProfileId', value: permawebProvider.profile.id },
						];

						let claimable = false;
						let claimed = false;
						let aoResponse = null;
						let dryrunResult = null;

						try {
							// console.log(`🌐 Making AO call for ${asset.title}...`);
							// Try direct AO call first
							aoResponse = await messageResult({
								processId: asset.id,
								wallet: arProvider.wallet,
								action: 'Get-Claim-Status',
								tags: tags,
								data: null,
							});

							// console.log(`✅ AO response for ${asset.title}:`, aoResponse);

							if (aoResponse && aoResponse['Claim-Status-Response'] && aoResponse['Claim-Status-Response'].status) {
								claimable = aoResponse['Claim-Status-Response'].status === 'Claimable';
								claimed = aoResponse['Claim-Status-Response'].status === 'Claimed';
								// console.log(`🎯 ${asset.title} AO status:`, {
								// 	status: aoResponse['Claim-Status-Response'].status,
								// 	claimable: claimable,
								// 	claimed: claimed
								// });
							} else {
								// console.log(`⚠️ ${asset.title} AO response missing status:`, aoResponse);
							}
						} catch (aoError) {
							// console.log(`❌ AO call failed for ${asset.title}:`, aoError);

							// Fallback: Use permaweb-libs dryrun
							try {
								// console.log(`🔄 Trying dryrun fallback for ${asset.title}...`);
								dryrunResult = await permawebProvider.libs?.dryrun({
									processId: asset.id,
									action: 'Get-Claim-Status',
									tags: tags,
									data: null,
								});

								// console.log(`📊 Dryrun result for ${asset.title}:`, dryrunResult);

								if (dryrunResult && dryrunResult.success) {
									// console.log(`✅ ${asset.title} dryrun successful`);
									// Parse dryrun result to determine claim status
									// For now, we'll use a simple heuristic
									if (dryrunResult.result && dryrunResult.result.includes('Claimable')) {
										claimable = true;
									} else if (dryrunResult.result && dryrunResult.result.includes('Claimed')) {
										claimed = true;
									}
								} else {
									// console.log(`❌ ${asset.title} dryrun failed:`, dryrunResult);
								}
							} catch (dryrunError) {
								console.error(`💥 Dryrun also failed for ${asset.title}:`, dryrunError);
							}
						}

						// Check if requirements are met based on type
						let requirementMet = false;
						if (asset.requirementType === 'wander') {
							const correspondingQuest = quests.find((q) => q.id === asset.questRequirement);
							requirementMet = correspondingQuest && correspondingQuest.isCompleted;

							// console.log(`🔍 ${asset.title} requirement check:`, {
							// 	assetTitle: asset.title,
							// 	questId: asset.questRequirement,
							// 	correspondingQuest: correspondingQuest,
							// 	questCompleted: correspondingQuest?.isCompleted,
							// 	requirementMet: requirementMet,
							// 	claimable: claimable,
							// 	claimed: claimed,
							// 	finalClaimable: claimable && requirementMet,
							// 	aoResponse: aoResponse,
							// 	dryrunResult: dryrunResult
							// });
						} else if (asset.requirementType === 'stamping') {
							requirementMet = progress.hasStampedAsset === true;
							// console.log(`🔍 ${asset.title} stamping requirement:`, {
							// 	hasStampedAsset: progress.hasStampedAsset,
							// 	requirementMet: requirementMet,
							// 	claimable: claimable,
							// 	claimed: claimed
							// });
						} else if (asset.requirementType === 'auto-gold') {
							// Platinum DumDum is auto-completed when Gold DumDum is claimed
							const createProfileQuest = quests.find((q) => q.id === 'create-profile');
							requirementMet = createProfileQuest && createProfileQuest.isCompleted;
							// console.log(`🔍 ${asset.title} auto-gold requirement:`, {
							// 	createProfileQuest: createProfileQuest,
							// 	questCompleted: createProfileQuest?.isCompleted,
							// 	requirementMet: requirementMet,
							// 	claimable: claimable,
							// 	claimed: claimed
							// });
						} else {
							requirementMet = claimable;
						}

						const finalAsset = {
							...asset,
							claimable: claimable && requirementMet,
							claimed: claimed,
							claimInProgress: false,
						};

						// console.log(`📝 Final asset state for ${asset.title}:`, {
						// 	claimable: finalAsset.claimable,
						// 	claimed: finalAsset.claimed,
						// 	requirementMet: requirementMet
						// });

						return finalAsset;
					})
				);

				// console.log('🎯 All assets processed. Final results:', results.map(r => ({
				// 	title: r.title,
				// 	claimable: r.claimable,
				// 	claimed: r.claimed
				// })));

				return results;
			});

			setCampaign2Assets(updatedAssets);
			// console.log('✅ Campaign 2 claim status updated successfully');
		} catch (error) {
			console.error('💥 Error checking Campaign 2 asset claim status:', error);
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

					// Set current profile ring to match the user's current Wander tier
					if (wanderTierInfo?.tier) {
						const ring = Object.values(WANDER_PROFILE_RINGS).find((r) => r.tier === wanderTierInfo.tier);
						if (ring) {
							setCurrentProfileRing(ring.id);
						} else {
							// Default to Core if tier not found
							setCurrentProfileRing('wander-core');
						}
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

	// REMOVED: Moved quest utility functions outside component to prevent re-creation

	function getQuestCard(quest: Quest) {
		const questProgress = getQuestProgress(quest.id, quests);
		const completed = isQuestCompleted(quest.id, quests);
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

						<S.QuestProgress>
							{questProgress} / {quest.required}
						</S.QuestProgress>
					</S.QuestInfo>
					{/* Removed tier badge - not relevant for quest tiles */}
					{hasTierMultiplier && <S.TierMultiplier>{quest.reward.multiplier}x</S.TierMultiplier>}
				</S.QuestHeader>

				<S.QuestReward>
					<S.RewardIcon>
						<img
							src={getWanderTierIcon(quest.tier)}
							alt={`${quest.tier} tier`}
							onError={(e) => {
								// Fallback to star if tier icon not found
								e.currentTarget.src = ASSETS.star;
							}}
						/>
					</S.RewardIcon>
					<div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
						<div style={{ flex: 1 }}>
							<S.RewardText>{quest.reward.description}</S.RewardText>

							{hasTierMultiplier && <S.TierBoost>🎯 {quest.reward.tier} Boost Active!</S.TierBoost>}
						</div>
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

		// Check if this ring matches the user's current Wander tier
		const isEarned = ring.tier === wanderTierInfo?.tier;
		const isActive = currentProfileRing === ring.id || (wanderTierInfo?.tier && ring.tier === wanderTierInfo.tier);

		return (
			<S.ProfileRingCard key={ring.id}>
				<S.ProfileRingPreview>
					<S.ProfileRingAvatar>
						{isActive ? <S.ProfileRingBorder color={ring.color} /> : <S.ProfileRingBorderInactive color={ring.color} />}
						<img src={ASSETS.user} alt="Profile Preview" />
					</S.ProfileRingAvatar>
					<S.ProfileRingActive isActive={isActive}>
						{isActive ? 'ACTIVE' : isEarned ? 'EARNED' : 'LOCKED'}
					</S.ProfileRingActive>
				</S.ProfileRingPreview>
				<S.ProfileRingInfo>
					<div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
						<S.ProfileRingName>{ring.name}</S.ProfileRingName>
						<img src={getWanderTierBadge(ring.tier, true)} alt={ring.tier} style={{ height: '28px', width: 'auto' }} />
					</div>
					<S.ProfileRingDescription>{ring.description}</S.ProfileRingDescription>
					{!isEarned && (
						<div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#9ca3af' }}>
							Reach {ring.tier} tier in your Wander wallet to unlock this ring
						</div>
					)}
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

	function getBronzeDumDumCard(asset: (typeof campaign2Assets)[0]) {
		return (
			<div
				key={asset.id}
				style={{
					background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
					borderRadius: '20px',
					padding: '30px',
					boxShadow: '0 10px 30px rgba(251, 191, 36, 0.3)',
					border: '3px solid #d97706',
					maxWidth: '400px',
					width: '100%',
					textAlign: 'center',
					position: 'relative',
					overflow: 'hidden',
				}}
				className={'fade-in'}
			>
				{/* Bronze DumDum Image */}
				<div
					style={{
						marginBottom: '20px',
					}}
				>
					<img
						src="https://arweave.net/aTJROeqDmiAglMdsrubdBcdewn69K1wqguUwIweZVZI"
						alt={asset.title}
						style={{
							width: '240px',
							height: '240px',
							borderRadius: '20px',
							border: '6px solid #d97706',
							boxShadow: '0 12px 30px rgba(0,0,0,0.3)',
							objectFit: 'cover',
						}}
						onError={(e) => {
							e.currentTarget.style.display = 'none';
							const nextElement = e.currentTarget.nextElementSibling as HTMLElement;
							if (nextElement) {
								nextElement.style.display = 'flex';
							}
						}}
					/>
					<div
						style={{
							width: '120px',
							height: '120px',
							borderRadius: '15px',
							border: '4px solid #d97706',
							boxShadow: '0 8px 20px rgba(0,0,0,0.2)',
							background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
							display: 'none',
							alignItems: 'center',
							justifyContent: 'center',
							fontSize: '3rem',
							color: '#92400e',
							fontWeight: 'bold',
						}}
					>
						🏆
					</div>
				</div>

				{/* Title */}
				<h3
					style={{
						color: '#92400e',
						fontSize: '1.8rem',
						fontWeight: 'bold',
						marginBottom: '10px',
						textShadow: '0 2px 4px rgba(0,0,0,0.1)',
					}}
				>
					{asset.title}
				</h3>

				{/* Description */}
				<p
					style={{
						color: '#78350f',
						fontSize: '1.1rem',
						marginBottom: '25px',
						lineHeight: '1.4',
					}}
				>
					{asset.description}
				</p>

				{/* Claim Button or Status */}
				{asset.claimable && !asset.claimed && (
					<button
						onClick={() => handleClaimCampaign2Asset(asset.id)}
						disabled={asset.claimInProgress}
						style={{
							background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
							color: 'white',
							border: 'none',
							borderRadius: '12px',
							padding: '15px 30px',
							fontSize: '1.2rem',
							fontWeight: 'bold',
							cursor: asset.claimInProgress ? 'not-allowed' : 'pointer',
							boxShadow: '0 6px 15px rgba(220, 38, 38, 0.4)',
							transition: 'all 0.3s ease',
							opacity: asset.claimInProgress ? 0.7 : 1,
							transform: asset.claimInProgress ? 'scale(0.95)' : 'scale(1)',
						}}
						onMouseEnter={(e) => {
							if (!asset.claimInProgress) {
								e.currentTarget.style.transform = 'scale(1.05)';
								e.currentTarget.style.boxShadow = '0 8px 20px rgba(220, 38, 38, 0.6)';
							}
						}}
						onMouseLeave={(e) => {
							if (!asset.claimInProgress) {
								e.currentTarget.style.transform = 'scale(1)';
								e.currentTarget.style.boxShadow = '0 6px 15px rgba(220, 38, 38, 0.4)';
							}
						}}
					>
						{asset.claimInProgress ? '🎯 Claiming...' : '🎯 Claim Bronze DumDum'}
					</button>
				)}

				{asset.claimed && (
					<div
						style={{
							background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
							color: 'white',
							borderRadius: '12px',
							padding: '15px 30px',
							fontSize: '1.2rem',
							fontWeight: 'bold',
							boxShadow: '0 6px 15px rgba(16, 185, 129, 0.4)',
						}}
					>
						✅ Bronze DumDum Claimed!
					</div>
				)}

				{!asset.claimable && !asset.claimed && (
					<div
						style={{
							background: 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)',
							color: 'white',
							borderRadius: '12px',
							padding: '15px 30px',
							fontSize: '1.1rem',
							fontWeight: 'bold',
							boxShadow: '0 6px 15px rgba(107, 114, 128, 0.4)',
						}}
					>
						🔒 Complete all quests to unlock
					</div>
				)}
			</div>
		);
	}

	const subheader = React.useMemo(() => {
		let label: string;
		let action = null;

		if (!arProvider.walletAddress) {
			label = language.connectWallet;
			action = () => arProvider.setWalletModalVisible(true);
		} else {
			// Check if profile creation is in progress
			if (profileCreationInProgress) {
				label = 'Creating Profile...';
				action = null; // Disable action while creating
			} else if (permawebProvider.profile) {
				if (permawebProvider.profile.id) {
					label = permawebProvider.profile.username;
				} else {
					label = language.createProfile;
					action = () => {
						setProfileCreationInProgress(true);
						setShowProfileManage(true);
					};
				}
			} else {
				label = formatAddress(arProvider.walletAddress, false);
			}
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
							<img
								src={getWanderTierBadge(wanderTierInfo.tier, true)}
								alt={wanderTierInfo.tier}
								style={{ height: '40px', width: 'auto', marginTop: '4px' }}
							/>
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
											Current Tier:
											<img
												src={getWanderTierBadge(wanderTierInfo.tier, true)}
												alt={wanderTierInfo.tier}
												style={{ height: '20px', width: 'auto', marginLeft: '8px' }}
											/>
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
		// console.log('🔄 Force refreshing Campaign 2 cache...');
		// Clear all Campaign 2 related cache
		localStorage.removeItem(DRIVE_CONFIG_KEY);
		localStorage.removeItem(BRIDGE_DRIVE_VERSION_KEY);
		localStorage.removeItem('drive-config'); // Old Campaign 1 cache

		// Reload assets
		setCampaign2Assets([]);
		loadCampaign2Assets();
	}

	// Manual trigger for claim status checking

	// DISABLED: Auto-complete effect was causing excessive re-renders
	// Profile quest completion is now handled in the main data fetch function

	function getView() {
		return (
			<>
				<S.Wrapper className={'border-wrapper-alt2 fade-in'}>
					<S.Header>
						<S.HeaderMain>
							<h1>Wander Tier Quest</h1>
						</S.HeaderMain>
						{subheader}
					</S.Header>

					<S.Body>
						{/* Profile Loading Indicator */}
						{profileLoading && (
							<S.CampaignCompleteBanner
								className={'fade-in'}
								style={{ background: '#1f2937', border: '1px solid #374151' }}
							>
								<S.CampaignCompleteContent>
									<h3>⏳ Loading Your Profile...</h3>
									<p>Please wait while we load your Bazar profile data. This ensures accurate quest verification.</p>
								</S.CampaignCompleteContent>
							</S.CampaignCompleteBanner>
						)}

						{campaignCompleted && (
							<S.CampaignCompleteBanner className={'fade-in'}>
								<S.CampaignCompleteContent>
									<h3>🎉 Wander Campaign Completed!</h3>
									<p>
										Congratulations! You've completed all campaign quests and can now claim your Bronze DumDum!
										{tierAdvancementAttempted
											? ' Tier advancement has been requested!'
											: ' Processing tier advancement...'}
									</p>
									{wanderTierInfo && (
										<S.CurrentTierInfo>
											Current Tier:
											<img
												src={getWanderTierBadge(wanderTierInfo.tier, true)}
												alt={wanderTierInfo.tier}
												style={{ height: '20px', width: 'auto', marginLeft: '8px' }}
											/>
											{wanderTierInfo.balance && <> • Balance: {formatWanderBalance(wanderTierInfo.balance)} WNDR</>}
										</S.CurrentTierInfo>
									)}
								</S.CampaignCompleteContent>
							</S.CampaignCompleteBanner>
						)}

						<S.QuestsGrid>{quests.map((quest) => getQuestCard(quest))}</S.QuestsGrid>

						{/* Always show profile rings section - display all possible rings */}
						<S.ProfileRingsSection>
							<S.ProfileRingsHeader>
								<h2>Wander Profile Rings</h2>
								<p>
									<strong>🌟 Special Feature:</strong> Your Wander profile rings match your current Wander wallet tier!
									These rings are permanent rewards that you keep on Bazar - your avatar will display your special badge
									of honor!
								</p>
								<S.CurrentRingIndicator>
									Current Active Ring:{' '}
									<strong>
										{currentProfileRing
											? WANDER_PROFILE_RINGS[currentProfileRing as keyof typeof WANDER_PROFILE_RINGS]?.name ||
											  'Wander Core'
											: wanderTierInfo?.tier
											? `Wander ${wanderTierInfo.tier}`
											: 'Wander Core'}
									</strong>
								</S.CurrentRingIndicator>
							</S.ProfileRingsHeader>
							<S.ProfileRingsGrid>
								{/* Show all possible Wander profile rings */}
								{Object.keys(WANDER_PROFILE_RINGS).map((ringId) => getProfileRingCard(ringId))}
							</S.ProfileRingsGrid>
						</S.ProfileRingsSection>

						{(campaign2Loading || campaign2Assets.length > 0) && (
							<S.ProfileRingsSection>
								<S.ProfileRingsHeader>
									<h2>🏆 Bronze DumDum Reward</h2>
									<p>
										<strong>🌟 Ultimate Reward:</strong> Complete all 5 quests to claim your exclusive Bronze DumDum
										atomic asset! This is a special collectible that you can keep forever on Arweave!
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
										Loading Bronze DumDum...
									</div>
								) : (
									<div
										style={{
											display: 'flex',
											justifyContent: 'center',
											padding: '20px',
										}}
									>
										{campaign2Assets
											.filter(
												(asset) => asset.questRequirement === 'create-asset' && asset.requirementType === 'wander'
											)
											.map((asset) => getBronzeDumDumCard(asset))}
									</div>
								)}
							</S.ProfileRingsSection>
						)}
					</S.Body>

					<S.Footer>
						<p>Quest Rules</p>
						<br />
						<p>
							Complete one or more tasks to earn rewards. Rewards include WNDR tokens and exclusive colored profile
							rings that increase by tier! Complete all 5 quests to unlock the ultimate Bronze DumDum collectible. All
							quests must be completed with the same wallet address. Rewards are distributed automatically upon
							claiming.
						</p>
						<br />
						<p>
							🌟 <strong>Special Features:</strong>
							<br />
							• Profile rings are permanent rewards you keep on Bazar
							<br />
							• Bronze DumDum is a collectible atomic asset on Arweave
							<br />• Complete all quests to unlock the ultimate reward!
						</p>
						<br />
						<p>
							<strong>Powered by Wander Team</strong> - Earn WNDR tokens, profile rings, and exclusive collectibles!
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
						handleClose={() => {
							setShowProfileManage(false);
							setProfileCreationInProgress(false);
						}}
					>
						<S.PManageWrapper>
							<ProfileManage
								profile={permawebProvider.profile && permawebProvider.profile.id ? permawebProvider.profile : null}
								handleClose={() => {
									setShowProfileManage(false);
									setProfileCreationInProgress(false);
								}}
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
