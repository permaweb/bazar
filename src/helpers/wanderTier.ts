import { dryrun } from '@permaweb/aoconnect';

export type Tier = 'Prime' | 'Edge' | 'Reserve' | 'Select' | 'Core';

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
		if (typeof window !== 'undefined' && window.arweaveWallet && window.arweaveWallet.getWanderTierInfo) {
			const tierInfo = await window.arweaveWallet.getWanderTierInfo();
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
export function calculateTierRewards(baseWndr: number, basePixel: number, tier: Tier) {
	const multiplier = getTierMultiplier(tier);
	return {
		wndr: Math.floor(baseWndr * multiplier),
		pixel: Math.floor(basePixel * multiplier),
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

// Extend window interface for TypeScript
declare global {
	interface Window {
		arweaveWallet?: {
			getWanderTierInfo?: () => Promise<WanderTierInfo>;
		};
	}
}
