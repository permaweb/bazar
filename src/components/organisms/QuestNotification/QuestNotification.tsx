import React from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';

import { ASSETS, URLS } from 'helpers/config';
import { getTierMultiplier } from 'helpers/wanderTier';
import { RootState } from 'store';

import * as S from './styles';

// Tier colors matching official Wander badges
const TIER_COLORS = {
	Core: '#8b5cf6', // Purple from official Wander
	Select: '#06b6d4', // Cyan/teal from official Wander
	Reserve: '#10b981', // Green from official Wander
	Edge: '#6b7280', // Gray from official Wander
	Prime: '#f59e0b', // Amber/gold from official Wander
};

interface IProps {
	profile: any;
}

export default function QuestNotification(props: IProps) {
	const questsState = useSelector((state: RootState) => state.questsReducer);
	const { quests, progress } = questsState;

	const [showDropdown, setShowDropdown] = React.useState<boolean>(false);
	const dropdownRef = React.useRef<HTMLDivElement>(null);

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

	// Close dropdown when clicking outside
	React.useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
				setShowDropdown(false);
			}
		}

		if (showDropdown) {
			document.addEventListener('mousedown', handleClickOutside);
			return () => {
				document.removeEventListener('mousedown', handleClickOutside);
			};
		}
	}, [showDropdown]);

	if (totalQuests === 0) return null;

	return (
		<S.Wrapper ref={dropdownRef}>
			<S.WanderButton onClick={handleShowDropdown}>
				<S.WanderIconWrapper>
					<img src={ASSETS.wanderIconMain} alt="Wander Quests" />
					{availableRewards > 0 && <S.NotificationBadge>{availableRewards}</S.NotificationBadge>}
				</S.WanderIconWrapper>
			</S.WanderButton>
			{showDropdown && (
				<S.Dropdown>
					<div style={{ position: 'relative', width: '100%', height: '100%' }}>
						{progress.wanderTier && (
							<S.TierBadge
								tierColor={TIER_COLORS[progress.wanderTier as keyof typeof TIER_COLORS] || '#9333ea'}
								style={{
									position: 'absolute',
									top: '-4px',
									right: '-4px',
									zIndex: 1,
								}}
							>
								{progress.wanderTier}
							</S.TierBadge>
						)}
						<S.DropdownHeader>
							<h4>Quest Progress</h4>
							<S.ProgressText>
								{completedQuests} / {totalQuests} Completed
								{progress.wanderTier && tierMultiplier > 1 && (
									<span style={{ opacity: 0.8 }}>• {tierMultiplier}x Rewards</span>
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
							<Link
								to={URLS.quest}
								onClick={() => {
									// Small delay to ensure navigation happens before dropdown closes
									setTimeout(handleHideDropdown, 100);
								}}
							>
								<S.ViewQuestsButton>View All Quests</S.ViewQuestsButton>
							</Link>
						</S.ActionSection>
					</div>
				</S.Dropdown>
			)}
		</S.Wrapper>
	);
}
