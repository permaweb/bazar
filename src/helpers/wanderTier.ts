import { dryrun } from '@permaweb/aoconnect';

export type Tier = 'Prime' | 'Edge' | 'Reserve' | 'Select' | 'Core';

// WNDR Token ID
export const WNDR_TOKEN_ID = '7GoQfmSOct_aUOWKM4xbKGg6DzAmOgdKwg8Kf-CbHm4';

// Profile ring colors for Wander wallet tiers
export const WANDER_PROFILE_RINGS = {
	'wander-core': {
		id: 'wander-core',
		name: 'Wander Ring',
		description: 'Core tier - Starting your Wander journey',
		color: '#9D4EDD', // Purple to match the Core badge
		tier: 'Core',
	},
	'wander-select': {
		id: 'wander-select',
		name: 'Wander Ring',
		description: 'Select tier - Growing your WNDR balance',
		color: '#4B5563', // Dark blue-grey to match Select badge background
		tier: 'Select',
	},
	'wander-reserve': {
		id: 'wander-reserve',
		name: 'Wander Ring',
		description: 'Reserve tier - Active WNDR holder',
		color: '#6B7280', // Dark muted greenish-gray to match Reserve badge background
		tier: 'Reserve',
	},
	'wander-edge': {
		id: 'wander-edge',
		name: 'Wander Ring',
		description: 'Edge tier - Significant WNDR holdings',
		color: '#374151', // Dark gray to match Edge badge background
		tier: 'Edge',
	},
	'wander-prime': {
		id: 'wander-prime',
		name: 'Wander Ring',
		description: 'Prime tier - Elite WNDR holder',
		color: '#D97706', // Golden-brown to match Prime badge background
		tier: 'Prime',
	},
} as const;

export type WanderProfileRing = keyof typeof WANDER_PROFILE_RINGS;

export interface WanderTierInfo {
	tier: Tier;
	balance: string;
	rank: '' | number;
	progress: number;
	snapshotTimestamp: number;
	totalHolders: number;
}

const TIER_ID_TO_NAME = {
	1: 'Prime',
	2: 'Edge',
	3: 'Reserve',
	4: 'Select',
	5: 'Core',
} as const;

const TIER_MULTIPLIERS = {
	Prime: 2.0,
	Edge: 1.5,
	Reserve: 1.25,
	Select: 1.1,
	Core: 1.0,
} as const;

/**
 * Get Wander tier information for a wallet address using dryrun
 */
// Get current user's Wander tier for profile ring display
export async function getCurrentWanderTier(walletAddress: string): Promise<string | null> {
	try {
		const tierInfo = await getWanderTierInfo(walletAddress);
		return tierInfo?.tier || null;
	} catch (error) {
		console.log('Failed to get current Wander tier:', error);
		return null;
	}
}

export async function getWanderTierInfo(walletAddress: string): Promise<WanderTierInfo> {
	try {
		const dryrunRes = await dryrun({
			Owner: walletAddress,
			process: 'rkAezEIgacJZ_dVuZHOKJR8WKpSDqLGfgPJrs_Es7CA',
			tags: [{ name: 'Action', value: 'Get-Wallet-Info' }],
		});

		const message = dryrunRes.Messages?.[0];
		const data = JSON.parse(message?.Data || '{}');

		if (data?.tier === undefined || data?.tier === null) {
			throw new Error('No tier data found for the provided wallet address');
		}

		const tierInfo: WanderTierInfo = {
			...data,
			tier: TIER_ID_TO_NAME[data.tier as keyof typeof TIER_ID_TO_NAME],
		};

		return tierInfo;
	} catch (error) {
		console.error('Failed to retrieve tier information:', error);
		// Return default tier info if API fails
		return {
			tier: 'Core',
			balance: '0',
			rank: '',
			progress: 0,
			snapshotTimestamp: Date.now(),
			totalHolders: 0,
		};
	}
}

/**
 * Get Wander tier information using the injected API (if available)
 */
export async function getWanderTierInfoInjected(): Promise<WanderTierInfo | null> {
	try {
		// Check if Wander wallet is available
		if (typeof window !== 'undefined' && window.arweaveWallet && (window.arweaveWallet as any).getWanderTierInfo) {
			const tierInfo = await (window.arweaveWallet as any).getWanderTierInfo();
			return tierInfo;
		}
		return null;
	} catch (error) {
		console.error('Failed to retrieve tier information from injected API:', error);
		return null;
	}
}

/**
 * Get tier multiplier for reward calculations
 */
export function getTierMultiplier(tier: Tier): number {
	return TIER_MULTIPLIERS[tier] || 1.0;
}

/**
 * Calculate enhanced rewards based on user's Wander tier
 */
export function calculateTierRewards(baseWndr: number, tier: Tier) {
	const multiplier = getTierMultiplier(tier);
	return {
		wndr: Math.floor(baseWndr * multiplier),
		multiplier,
		tier,
	};
}

/**
 * Get tier-specific quest requirements
 */
export function getTierQuestRequirements(tier: Tier) {
	switch (tier) {
		case 'Prime':
			return {
				profileCreated: 1,
				firstAssetCreated: 1,
				firstCollectionCreated: 1,
				firstPurchaseMade: 1,
				pixelStaked: 1,
				bonusRequirements: ['highValuePurchase', 'socialEngagement'],
			};
		case 'Edge':
			return {
				profileCreated: 1,
				firstAssetCreated: 1,
				firstCollectionCreated: 1,
				firstPurchaseMade: 1,
				pixelStaked: 1,
				bonusRequirements: ['moderateValuePurchase'],
			};
		case 'Reserve':
			return {
				profileCreated: 1,
				firstAssetCreated: 1,
				firstCollectionCreated: 1,
				firstPurchaseMade: 1,
				pixelStaked: 1,
				bonusRequirements: [],
			};
		case 'Select':
			return {
				profileCreated: 1,
				firstAssetCreated: 1,
				firstCollectionCreated: 1,
				firstPurchaseMade: 1,
				pixelStaked: 0, // Optional for Select tier
				bonusRequirements: [],
			};
		case 'Core':
		default:
			return {
				profileCreated: 1,
				firstAssetCreated: 1,
				firstCollectionCreated: 0, // Optional for Core tier
				firstPurchaseMade: 1,
				pixelStaked: 0, // Optional for Core tier
				bonusRequirements: [],
			};
	}
}

/**
 * Get tier-specific quest descriptions
 */
export function getTierQuestDescription(questId: string, tier: Tier): string {
	const baseDescriptions = {
		'create-profile': 'Create your Bazar profile to start your journey',
		'create-asset': 'Upload and create your first atomic asset',
		'create-collection': 'Create a collection to organize your assets',
		'make-purchase': 'Buy your first atomic asset from the marketplace',
		'stake-pixel': 'Stake your PIXL tokens to earn rewards',
	};

	const baseDescription = baseDescriptions[questId as keyof typeof baseDescriptions] || '';

	switch (tier) {
		case 'Prime':
			return `${baseDescription} (Prime tier - 2x rewards!)`;
		case 'Edge':
			return `${baseDescription} (Edge tier - 1.5x rewards!)`;
		case 'Reserve':
			return `${baseDescription} (Reserve tier - 1.25x rewards!)`;
		case 'Select':
			return `${baseDescription} (Select tier - 1.1x rewards!)`;
		case 'Core':
		default:
			return baseDescription;
	}
}

/**
 * Get profile ring for a completed quest
 */
export function getProfileRingForTier(tier: string): (typeof WANDER_PROFILE_RINGS)[WanderProfileRing] | null {
	const ring = Object.values(WANDER_PROFILE_RINGS).find((r) => r.tier === tier);
	return ring || null;
}

/**
 * Get all profile rings earned by completing quests
 */
export function getEarnedProfileRings(
	completedQuests: string[]
): Array<(typeof WANDER_PROFILE_RINGS)[WanderProfileRing]> {
	return completedQuests.map((questId) => getProfileRingForTier(questId)).filter(Boolean) as Array<
		(typeof WANDER_PROFILE_RINGS)[WanderProfileRing]
	>;
}

/**
 * Get the highest tier profile ring earned
 */
export function getHighestProfileRing(
	completedQuests: string[]
): (typeof WANDER_PROFILE_RINGS)[WanderProfileRing] | null {
	const earnedRings = getEarnedProfileRings(completedQuests);
	if (earnedRings.length === 0) return null;

	// Order by tier hierarchy: Core < Select < Reserve < Edge < Prime
	const tierOrder = ['Core', 'Select', 'Reserve', 'Edge', 'Prime'];

	return earnedRings.reduce((highest, current) => {
		const highestTierIndex = tierOrder.indexOf(highest.tier);
		const currentTierIndex = tierOrder.indexOf(current.tier);
		return currentTierIndex > highestTierIndex ? current : highest;
	});
}

/**
 * Submit tier advancement request to Wander team
 * This would need to be implemented in coordination with the Wander team
 */
export async function requestTierAdvancement(walletAddress: string, campaignData: any): Promise<boolean> {
	try {
		console.log('Requesting tier advancement for:', walletAddress);
		console.log('Campaign completion data:', campaignData);

		// TODO: Implement actual API call to Wander team's tier advancement endpoint
		// This could be:
		// 1. A direct API call to Wander's backend
		// 2. An on-chain transaction to a Wander smart contract
		// 3. A message to a Wander AO process

		// Example of what this might look like:
		/*
		const response = await fetch('https://api.wander.app/tier-advancement', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${await getAuthToken()}`
			},
			body: JSON.stringify({
				walletAddress,
				campaignType: 'bazar-quest-completion',
				completionData: campaignData,
				timestamp: Date.now()
			})
		});
		
		return response.ok;
		*/

		// For now, return true to indicate the request was "submitted"
		return true;
	} catch (error) {
		console.error('Error requesting tier advancement:', error);
		return false;
	}
}

/**
 * Get tier advancement eligibility
 */
export function getTierAdvancementEligibility(currentTier: Tier): {
	canAdvance: boolean;
	nextTier?: Tier;
	requirements?: string[];
} {
	const tierOrder: Tier[] = ['Core', 'Select', 'Reserve', 'Edge', 'Prime'];
	const currentIndex = tierOrder.indexOf(currentTier);

	if (currentIndex === -1 || currentIndex === tierOrder.length - 1) {
		return { canAdvance: false };
	}

	const nextTier = tierOrder[currentIndex + 1];
	const requirements = [
		'Complete all Bazar quest campaign tasks',
		'Maintain WNDR token balance',
		'Demonstrate platform engagement',
	];

	return {
		canAdvance: true,
		nextTier,
		requirements,
	};
}

// Note: Using 'any' type casting for Wander wallet extensions
// to avoid conflicts with existing ArConnect wallet types
