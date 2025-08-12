import { ReduxActionType } from 'helpers/types';

import { CLAIM_QUEST_REWARD, COMPLETE_QUEST, SET_QUEST_REWARDS, SET_QUESTS, UPDATE_QUEST_PROGRESS } from './constants';
import { Quest, QuestProgress, QuestState } from './types';

export const initStateQuests: QuestState = {
	quests: [],
	progress: {
		profileCreated: false,
		firstAssetCreated: false,
		firstCollectionCreated: false,
		firstPurchaseMade: false,
		pixelStaked: false,
		totalPurchases: 0,
		totalAssets: 0,
		totalCollections: 0,
	},
	rewards: [],
	loading: false,
	error: null,
};

export function questsReducer(state: QuestState = initStateQuests, action: ReduxActionType): QuestState {
	switch (action.type) {
		case SET_QUESTS:
			return {
				...state,
				quests: action.payload,
			};
		case UPDATE_QUEST_PROGRESS:
			return {
				...state,
				progress: { ...state.progress, ...action.payload },
			};
		case COMPLETE_QUEST:
			return {
				...state,
				quests: state.quests.map((quest: Quest) =>
					quest.id === action.payload ? { ...quest, isCompleted: true } : quest
				),
			};
		case CLAIM_QUEST_REWARD:
			return {
				...state,
				quests: state.quests.map((quest: Quest) =>
					quest.id === action.payload ? { ...quest, isClaimed: true } : quest
				),
			};
		case SET_QUEST_REWARDS:
			return {
				...state,
				rewards: action.payload,
			};
		default:
			return state;
	}
}
