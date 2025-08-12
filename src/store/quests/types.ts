export interface Quest {
	id: string;
	title: string;
	description: string;
	icon: string;
	required: number;
	completed: number;
	isCompleted: boolean;
	isClaimed: boolean;
	reward: QuestReward;
	tier: QuestTier;
}

export interface QuestReward {
	wndr: number;
	pixel: number;
	description: string;
	multiplier?: number;
	tier?: string;
}

export type QuestTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface QuestProgress {
	profileCreated: boolean;
	firstAssetCreated: boolean;
	firstCollectionCreated: boolean;
	firstPurchaseMade: boolean;
	pixelStaked: boolean;
	totalPurchases: number;
	totalAssets: number;
	totalCollections: number;
	wanderTier?: string;
	wanderBalance?: string;
	wanderRank?: string | number;
}

export interface QuestState {
	quests: Quest[];
	progress: QuestProgress;
	rewards: QuestReward[];
	loading: boolean;
	error: string | null;
	wanderTierInfo?: any;
}
