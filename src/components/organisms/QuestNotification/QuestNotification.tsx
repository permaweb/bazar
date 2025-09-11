import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router-dom';

import { ASSETS, URLS } from 'helpers/config';
import { getTierMultiplier } from 'helpers/wanderTier';
import { getWanderTierBadge } from 'helpers/wanderTierBadges';
import { RootState } from 'store';
import { setQuests } from 'store/quests/actions';

import * as S from './styles';

// Tier colors matching official Wander badges (currently unused)
// const TIER_COLORS = {
// 	Core: '#8b5cf6', // Purple from official Wander
// 	Select: '#06b6d4', // Cyan/teal from official Wander
// 	Reserve: '#10b981', // Green from official Wander
// 	Edge: '#6b7280', // Gray from official Wander
// 	Prime: '#f59e0b', // Amber/gold from official Wander
// };

interface IProps {
	profile: any;
}

export default function QuestNotification(_props: IProps) {
	const dispatch = useDispatch();
	const questsState = useSelector((state: RootState) => state.questsReducer);
	const { quests, progress } = questsState;

	const [showDropdown, setShowDropdown] = React.useState<boolean>(false);
	const dropdownRef = React.useRef<HTMLDivElement>(null);

	// Initialize quests if not already loaded
	React.useEffect(() => {
		if (quests.length === 0) {
			console.log('🔧 QuestNotification: Initializing quests...');
			// Import quest config and initialize quests
			import('views/Quests/index').then((_module) => {
				// Get the quest config from the Quests component
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

				const initialQuests = Object.values(QUEST_CONFIG).map((config) => ({
					...config,
					completed: 0,
					isCompleted: false,
					isClaimed: false,
				}));
				console.log('🔧 QuestNotification: Dispatching quests:', initialQuests.length);
				dispatch(setQuests(initialQuests));
			});
		}
	}, [dispatch, quests.length]);

	// Calculate quest statistics
	const totalQuests = quests.length;
	const completedQuests = quests.filter((quest) => quest.isCompleted).length;
	const claimedQuests = quests.filter((quest) => quest.isClaimed).length;
	const availableRewards = quests.filter((quest) => quest.isCompleted && !quest.isClaimed).length;

	// Debug quest state
	console.log('🔧 QuestNotification: Current state:', {
		totalQuests,
		completedQuests,
		claimedQuests,
		availableRewards,
		quests: quests.map((q) => ({ id: q.id, isCompleted: q.isCompleted, isClaimed: q.isClaimed })),
	});

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

	// Show loading state if quests are not yet initialized
	if (totalQuests === 0) {
		return (
			<S.Wrapper ref={dropdownRef}>
				<S.WanderButton onClick={handleShowDropdown}>
					<S.WanderIconWrapper>
						<img src={ASSETS.wander} alt="Wander Quests" />
					</S.WanderIconWrapper>
				</S.WanderButton>
			</S.Wrapper>
		);
	}

	return (
		<S.Wrapper ref={dropdownRef}>
			<S.WanderButton onClick={handleShowDropdown}>
				<S.WanderIconWrapper>
					<img src={ASSETS.wander} alt="Wander Quests" />
					{availableRewards > 0 && <S.NotificationBadge>{availableRewards}</S.NotificationBadge>}
				</S.WanderIconWrapper>
			</S.WanderButton>
			{showDropdown && (
				<S.Dropdown>
					<div style={{ position: 'relative', width: '100%', height: '100%' }}>
						{progress.wanderTier && (
							<img
								src={getWanderTierBadge(progress.wanderTier, true)}
								alt={progress.wanderTier}
								style={{
									position: 'absolute',
									top: '-6px',
									right: '-6px',
									zIndex: 1,
									height: '32px',
									width: 'auto',
								}}
							/>
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
