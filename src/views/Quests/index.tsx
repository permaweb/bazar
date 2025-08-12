import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import { messageResult, readHandler } from 'api';

import { Modal } from 'components/molecules/Modal';
import { Panel } from 'components/molecules/Panel';
import { ProfileManage } from 'components/organisms/ProfileManage';
import { ASSETS, URLS } from 'helpers/config';
import { getTxEndpoint } from 'helpers/endpoints';
import { questTracker } from 'helpers/questTracker';
import { formatAddress } from 'helpers/utils';
import { calculateTierRewards, getTierMultiplier, getTierQuestDescription } from 'helpers/wanderTier';
import { useArweaveProvider } from 'providers/ArweaveProvider';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { usePermawebProvider } from 'providers/PermawebProvider';
import { RootState } from 'store';
import { claimQuestReward, completeQuest, Quest, QuestProgress, setQuests, updateQuestProgress } from 'store/quests';

import * as S from './styles';

const QUEST_CONFIG = {
	createProfile: {
		id: 'create-profile',
		title: 'Create Profile',
		description: 'Create your Bazar profile to start your journey',
		icon: ASSETS.user,
		required: 1,
		tier: 'bronze' as const,
		reward: { wndr: 10, pixel: 50, description: '10 WNDR + 50 PIXL' },
	},
	createAsset: {
		id: 'create-asset',
		title: 'Create Your First Asset',
		description: 'Upload and create your first atomic asset',
		icon: ASSETS.asset,
		required: 1,
		tier: 'silver' as const,
		reward: { wndr: 25, pixel: 100, description: '25 WNDR + 100 PIXL' },
	},
	createCollection: {
		id: 'create-collection',
		title: 'Create Your First Collection',
		description: 'Create a collection to organize your assets',
		icon: ASSETS.collection,
		required: 1,
		tier: 'silver' as const,
		reward: { wndr: 25, pixel: 100, description: '25 WNDR + 100 PIXL' },
	},
	makePurchase: {
		id: 'make-purchase',
		title: 'Make Your First Purchase',
		description: 'Buy your first atomic asset from the marketplace',
		icon: ASSETS.buy,
		required: 1,
		tier: 'gold' as const,
		reward: { wndr: 50, pixel: 200, description: '50 WNDR + 200 PIXL' },
	},
	stakePixel: {
		id: 'stake-pixel',
		title: 'Stake Pixel',
		description: 'Stake your PIXL tokens to earn rewards',
		icon: ASSETS.pixl,
		required: 1,
		tier: 'platinum' as const,
		reward: { wndr: 100, pixel: 500, description: '100 WNDR + 500 PIXL' },
	},
};

export default function Quests() {
	const navigate = useNavigate();
	const dispatch = useDispatch();

	const permawebProvider = usePermawebProvider();
	const arProvider = useArweaveProvider();
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const questsState = useSelector((state: RootState) => state.questsReducer);
	const { quests, progress } = questsState;

	const [showProfileManage, setShowProfileManage] = React.useState<boolean>(false);
	const [claimingQuest, setClaimingQuest] = React.useState<string | null>(null);
	const [claimNotification, setClaimNotification] = React.useState<{ questId: string; reward: any } | null>(null);
	const [wanderTierInfo, setWanderTierInfo] = React.useState<any>(null);

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

	// Check quest progress when profile or wallet changes
	React.useEffect(() => {
		if (arProvider.walletAddress && permawebProvider.profile) {
			checkQuestProgress();
		}
	}, [arProvider.walletAddress, permawebProvider.profile, permawebProvider.tokenBalances]);

	// Update quests with tier-based rewards when Wander tier info is available
	React.useEffect(() => {
		if (wanderTierInfo && quests.length > 0) {
			updateQuestsWithTierRewards();
		}
	}, [wanderTierInfo, quests.length]);

	async function checkQuestProgress() {
		if (!arProvider.walletAddress || !permawebProvider.profile) return;

		// Use the quest tracker to get comprehensive progress
		const progress = await questTracker.getQuestProgress(permawebProvider.profile.id, arProvider.walletAddress);
		dispatch(updateQuestProgress(progress));

		// Store Wander tier info for quest updates
		if (progress.wanderTier) {
			setWanderTierInfo({
				tier: progress.wanderTier,
				balance: progress.wanderBalance,
				rank: progress.wanderRank,
			});
		}
	}

	function updateQuestsWithTierRewards() {
		if (!wanderTierInfo) return;

		const updatedQuests = quests.map((quest) => {
			const baseReward = QUEST_CONFIG[quest.id as keyof typeof QUEST_CONFIG];
			if (!baseReward) return quest;

			const tierRewards = calculateTierRewards(baseReward.reward.wndr, baseReward.reward.pixel, wanderTierInfo.tier);
			const tierDescription = getTierQuestDescription(quest.id, wanderTierInfo.tier);

			return {
				...quest,
				description: tierDescription,
				reward: {
					wndr: tierRewards.wndr,
					pixel: tierRewards.pixel,
					description: `${tierRewards.wndr} WNDR + ${tierRewards.pixel} PIXL (${wanderTierInfo.tier} tier - ${tierRewards.multiplier}x)`,
					multiplier: tierRewards.multiplier,
					tier: wanderTierInfo.tier,
				},
			};
		});

		dispatch(setQuests(updatedQuests));
	}

	async function handleClaimQuest(questId: string) {
		if (!arProvider.walletAddress || !permawebProvider.profile) return;

		setClaimingQuest(questId);

		try {
			// Here you would integrate with the Ario team's reward distribution system
			// For now, we'll simulate the claim process

			// Simulate API call to claim rewards
			await new Promise((resolve) => setTimeout(resolve, 2000));

			// Update quest state
			dispatch(claimQuestReward(questId));

			// Show notification
			const quest = quests.find((q) => q.id === questId);
			if (quest) {
				setClaimNotification({ questId, reward: quest.reward });
			}
		} catch (error) {
			console.error('Error claiming quest reward:', error);
		} finally {
			setClaimingQuest(null);
		}
	}

	function getQuestProgress(questId: string): number {
		switch (questId) {
			case 'create-profile':
				return progress.profileCreated ? 1 : 0;
			case 'create-asset':
				return progress.firstAssetCreated ? 1 : 0;
			case 'create-collection':
				return progress.firstCollectionCreated ? 1 : 0;
			case 'make-purchase':
				return progress.firstPurchaseMade ? 1 : 0;
			case 'stake-pixel':
				return progress.pixelStaked ? 1 : 0;
			default:
				return 0;
		}
	}

	function isQuestCompleted(questId: string): boolean {
		return getQuestProgress(questId) >= QUEST_CONFIG[questId as keyof typeof QUEST_CONFIG]?.required;
	}

	function getQuestCard(quest: Quest) {
		const progress = getQuestProgress(quest.id);
		const completed = isQuestCompleted(quest.id);
		const isClaiming = claimingQuest === quest.id;
		const hasTierMultiplier = quest.reward.multiplier && quest.reward.multiplier > 1;

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
							{progress} / {quest.required}
						</S.QuestProgress>
					</S.QuestInfo>
					<S.QuestTier tier={quest.tier}>
						{quest.tier.toUpperCase()}
						{hasTierMultiplier && <S.TierMultiplier>{quest.reward.multiplier}x</S.TierMultiplier>}
					</S.QuestTier>
				</S.QuestHeader>

				<S.QuestReward>
					<S.RewardIcon>
						<img src={ASSETS.star} alt="Reward" />
					</S.RewardIcon>
					<S.RewardText>{quest.reward.description}</S.RewardText>
					{hasTierMultiplier && <S.TierBoost>🎯 {quest.reward.tier} Boost Active!</S.TierBoost>}
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
					) : (
						<S.ProgressBar>
							<S.ProgressFill progress={(progress / quest.required) * 100} />
						</S.ProgressBar>
					)}
				</S.QuestAction>
			</S.QuestCard>
		);
	}

	const subheader = React.useMemo(() => {
		let label: string;
		let action = null;

		if (!arProvider.walletAddress) {
			label = language.connectWallet;
			action = () => arProvider.setWalletModalVisible(true);
		} else {
			if (permawebProvider.profile) {
				if (permawebProvider.profile.id) {
					label = permawebProvider.profile.username;
				} else {
					label = language.createProfile;
					action = () => setShowProfileManage(true);
				}
			} else label = formatAddress(arProvider.walletAddress, false);
		}

		const active = arProvider.walletAddress !== null;

		return (
			<S.Subheader>
				<p>
					Complete quests to earn WNDR and PIXL tokens! Each quest tier offers increasing rewards. Start your journey by
					creating a profile and exploring the atomic asset ecosystem.
					{wanderTierInfo && (
						<>
							<br />
							<strong>Your Wander Tier: {wanderTierInfo.tier}</strong>
							{wanderTierInfo.rank && wanderTierInfo.rank !== '' && <> • Rank: #{wanderTierInfo.rank}</>}
							{wanderTierInfo.balance && <> • Balance: {parseFloat(wanderTierInfo.balance).toLocaleString()} WNDR</>}
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
			return (
				<Modal header={null} handleClose={() => setClaimNotification(null)}>
					<S.MWrapper>
						<S.MContentWrapper>
							<S.AssetTextWrapper>
								<p>Congratulations!</p>
								<span>You've completed</span>
								<span>{quest?.title}</span>
							</S.AssetTextWrapper>
							<S.RewardDisplay>
								<S.RewardItem>
									<span>{claimNotification.reward.wndr} WNDR</span>
								</S.RewardItem>
								<S.RewardItem>
									<span>{claimNotification.reward.pixel} PIXL</span>
								</S.RewardItem>
							</S.RewardDisplay>
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

	function getView() {
		return (
			<>
				<S.Wrapper className={'border-wrapper-alt2 fade-in'}>
					<S.Header>
						<S.HeaderMain>
							<h1>Wander Team Quests 🎯</h1>
						</S.HeaderMain>
						{subheader}
					</S.Header>

					<S.Body>
						<S.QuestsGrid>{quests.map((quest) => getQuestCard(quest))}</S.QuestsGrid>
					</S.Body>

					<S.Footer>
						<p>Quest Rules</p>
						<br />
						<p>
							Complete one or more tasks to earn rewards. Rewards include WNDR and PIXL tokens and increase by tier. All
							quests must be completed with the same wallet address. Rewards are distributed automatically upon
							claiming.
						</p>
						<br />
						<p>
							Bronze Tier: Basic profile and asset creation
							<br />
							Silver Tier: Collection creation and asset management
							<br />
							Gold Tier: Marketplace participation and purchases
							<br />
							Platinum Tier: Advanced features like staking
						</p>
						<br />
						<p>
							<strong>Powered by Wander Team</strong> - Earn WNDR tokens and PIXL rewards based on your Wander tier!
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
						handleClose={() => setShowProfileManage(false)}
					>
						<S.PManageWrapper>
							<ProfileManage
								profile={permawebProvider.profile && permawebProvider.profile.id ? permawebProvider.profile : null}
								handleClose={() => setShowProfileManage(false)}
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
