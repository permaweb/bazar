// Import badge images directly
// Import tier icons
import coreIcon from 'assets/wander-tiers/core/Core.png';
import coreDark from 'assets/wander-tiers/core/dark.png';
import coreLight from 'assets/wander-tiers/core/light.png';
import edgeDark from 'assets/wander-tiers/edge/dark.png';
import edgeIcon from 'assets/wander-tiers/edge/Edge.png';
import edgeLight from 'assets/wander-tiers/edge/light.png';
import primeDark from 'assets/wander-tiers/prime/dark.png';
import primeLight from 'assets/wander-tiers/prime/light.png';
import primeIcon from 'assets/wander-tiers/prime/Prime.png';
import reserveDark from 'assets/wander-tiers/reserve/dark.png';
import reserveLight from 'assets/wander-tiers/reserve/light.png';
import reserveIcon from 'assets/wander-tiers/reserve/Reserve.png';
import selectDark from 'assets/wander-tiers/select/dark.png';
import selectLight from 'assets/wander-tiers/select/light.png';
import selectIcon from 'assets/wander-tiers/select/Select.png';

// Wander Tier Badge Utility
export type WanderTier = 'Core' | 'Select' | 'Reserve' | 'Edge' | 'Prime';

export interface WanderTierBadge {
	light: string;
	dark: string;
}

export const WANDER_TIER_BADGES: Record<WanderTier, WanderTierBadge> = {
	Core: {
		light: coreLight,
		dark: coreDark,
	},
	Select: {
		light: selectLight,
		dark: selectDark,
	},
	Reserve: {
		light: reserveLight,
		dark: reserveDark,
	},
	Edge: {
		light: edgeLight,
		dark: edgeDark,
	},
	Prime: {
		light: primeLight,
		dark: primeDark,
	},
};

export const WANDER_TIER_ICONS: Record<WanderTier, string> = {
	Core: coreIcon,
	Select: selectIcon,
	Reserve: reserveIcon,
	Edge: edgeIcon,
	Prime: primeIcon,
};

// Map quest tier names to Wander tier names
const QUEST_TIER_TO_WANDER_TIER: Record<string, WanderTier> = {
	bronze: 'Core',
	silver: 'Select',
	gold: 'Reserve',
	platinum: 'Edge',
	Core: 'Core',
	Select: 'Select',
	Reserve: 'Reserve',
	Edge: 'Edge',
	Prime: 'Prime',
};

// Get the appropriate badge URL based on tier and theme
export function getWanderTierBadge(tier: string, isDarkTheme: boolean = true): string {
	// Map quest tier to Wander tier
	const wanderTier = QUEST_TIER_TO_WANDER_TIER[tier];
	if (!wanderTier) {
		console.warn(`Unknown tier: ${tier}, defaulting to Core`);
		return WANDER_TIER_BADGES.Core.dark;
	}

	const badge = WANDER_TIER_BADGES[wanderTier];
	return isDarkTheme ? badge.dark : badge.light;
}

// Get the tier icon URL
export function getWanderTierIcon(tier: string): string {
	// Map quest tier to Wander tier
	const wanderTier = QUEST_TIER_TO_WANDER_TIER[tier];
	if (!wanderTier) {
		console.warn(`Unknown tier: ${tier}, defaulting to Core`);
		return WANDER_TIER_ICONS.Core;
	}

	return WANDER_TIER_ICONS[wanderTier];
}

// Format WNDR balance for display (fix the balance display issue)
export function formatWanderBalance(balance: string): string {
	// WNDR has 18 decimals, so we need to divide by 10^18
	const weiAmount = BigInt(balance);
	const wndrAmount = Number(weiAmount) / Math.pow(10, 18);

	// Format the result
	if (wndrAmount < 1) {
		// For small amounts, show more precision
		return wndrAmount.toFixed(6);
	} else if (wndrAmount >= 1e9) {
		return (wndrAmount / 1e9).toFixed(2) + 'B';
	} else if (wndrAmount >= 1e6) {
		return (wndrAmount / 1e6).toFixed(2) + 'M';
	} else if (wndrAmount >= 1e3) {
		return (wndrAmount / 1e3).toFixed(1) + 'K';
	} else {
		return wndrAmount.toFixed(2);
	}
}
