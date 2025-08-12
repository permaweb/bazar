import React from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';

import { ASSETS, URLS } from 'helpers/config';
import { getTierMultiplier } from 'helpers/wanderTier';
import { RootState } from 'store';

import * as S from './styles';

interface IProps {
	profile: any;
}

export default function QuestNotification(props: IProps) {
	const questsState = useSelector((state: RootState) => state.questsReducer);
	const { quests, progress } = questsState;

	const [showDropdown, setShowDropdown] = React.useState<boolean>(false);

	// Calculate quest statistics
	const totalQuests = quests.length;
	const completedQuests = quests.filter((quest) => quest.isCompleted).length;
	const claimedQuests = quests.filter((quest) => quest.isClaimed).length;
	const availableRewards = quests.filter((quest) => quest.isCompleted && !quest.isClaimed).length;

	const totalWndrReward = quests
		.filter((quest) => quest.isCompleted && !quest.isClaimed)
		.reduce((sum, quest) => sum + quest.reward.wndr, 0);

	const totalPixelReward = quests
		.filter((quest) => quest.isCompleted && !quest.isClaimed)
		.reduce((sum, quest) => sum + quest.reward.pixel, 0);

	const tierMultiplier = progress.wanderTier ? getTierMultiplier(progress.wanderTier) : 1;

	const handleShowDropdown = React.useCallback(() => {
		setShowDropdown(!showDropdown);
	}, [showDropdown]);

	const handleHideDropdown = React.useCallback(() => {
		setShowDropdown(false);
	}, []);

	if (totalQuests === 0) return null;

	return (
		<S.Wrapper>
			<S.Button onClick={handleShowDropdown} onBlur={handleHideDropdown}>
				<S.IconWrapper>
					<img src={ASSETS.star} alt="Quests" />
					{availableRewards > 0 && <S.NotificationBadge>{availableRewards}</S.NotificationBadge>}
				</S.IconWrapper>
			</S.Button>
			{showDropdown && (
				<S.Dropdown>
					<S.DropdownHeader>
						<h4>Quest Progress</h4>
						<S.ProgressText>
							{completedQuests} / {totalQuests} Completed
							{progress.wanderTier && (
								<>
									<br />
									<strong>{progress.wanderTier} Tier</strong>
									{tierMultiplier > 1 && ` • ${tierMultiplier}x Rewards`}
								</>
							)}
						</S.ProgressText>
					</S.DropdownHeader>

					<S.ProgressBar>
						<S.ProgressFill progress={(completedQuests / totalQuests) * 100} />
					</S.ProgressBar>

					{availableRewards > 0 && (
						<S.RewardsSection>
							<S.RewardsTitle>Available Rewards:</S.RewardsTitle>
							<S.RewardsList>
								{totalWndrReward > 0 && (
									<S.RewardItem>
										<span>{totalWndrReward} WNDR</span>
									</S.RewardItem>
								)}
								{totalPixelReward > 0 && (
									<S.RewardItem>
										<span>{totalPixelReward} PIXL</span>
									</S.RewardItem>
								)}
							</S.RewardsList>
						</S.RewardsSection>
					)}

					<S.ActionSection>
						<Link to={URLS.quest} onClick={handleHideDropdown}>
							<S.ViewQuestsButton>View All Quests</S.ViewQuestsButton>
						</Link>
					</S.ActionSection>
				</S.Dropdown>
			)}
		</S.Wrapper>
	);
}
