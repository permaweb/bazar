import { Dispatch } from 'redux';

import { CLAIM_QUEST_REWARD, COMPLETE_QUEST, SET_QUEST_REWARDS, SET_QUESTS, UPDATE_QUEST_PROGRESS } from './constants';
import { Quest, QuestProgress, QuestReward } from './types';

export function setQuests(payload: Quest[]) {
	return (dispatch: Dispatch) => {
		dispatch({
			type: SET_QUESTS,
			payload: payload,
		});
	};
}

export function updateQuestProgress(payload: Partial<QuestProgress>) {
	return (dispatch: Dispatch) => {
		dispatch({
			type: UPDATE_QUEST_PROGRESS,
			payload: payload,
		});
	};
}

export function completeQuest(questId: string) {
	return (dispatch: Dispatch) => {
		dispatch({
			type: COMPLETE_QUEST,
			payload: questId,
		});
	};
}

export function claimQuestReward(questId: string) {
	return (dispatch: Dispatch) => {
		dispatch({
			type: CLAIM_QUEST_REWARD,
			payload: questId,
		});
	};
}

export function setQuestRewards(payload: QuestReward[]) {
	return (dispatch: Dispatch) => {
		dispatch({
			type: SET_QUEST_REWARDS,
			payload: payload,
		});
	};
}
