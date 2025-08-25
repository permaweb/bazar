import styled from 'styled-components';

// Wander Team Quest System Styles

export const Wrapper = styled.div`
	display: flex;
	flex-direction: column;
	width: 100%;
	max-width: 1200px;
	margin: 0 auto;
	padding: 20px;
	min-height: 100vh;
`;

export const Header = styled.div`
	display: flex;
	flex-direction: column;
	align-items: center;
	text-align: center;
	margin-bottom: 40px;
`;

export const HeaderMain = styled.div`
	margin-bottom: 20px;

	h1 {
		font-size: 2.5rem;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}
`;

export const TitleWithLogo = styled.div`
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 16px;
	flex-wrap: wrap;

	@media (max-width: 640px) {
		gap: 12px;
	}
`;

export const WanderLogo = styled.img`
	width: 40px;
	height: 40px;
	border-radius: 50%;
	object-fit: contain;

	@media (max-width: 640px) {
		width: 32px;
		height: 32px;
	}
`;

export const Subheader = styled.div`
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 20px;
	max-width: 800px;
	margin: 0 auto;

	p {
		font-size: 1.1rem;
		line-height: 1.6;
		color: var(--text-secondary);
		margin: 0;
		text-align: center;
	}
`;

export const ProfileWrapper = styled.div<{ active: boolean }>`
	display: flex;
	align-items: center;
	padding: 12px 24px;
	background: ${(props) => (props.active ? 'var(--primary-color)' : 'var(--background-secondary)')};
	color: ${(props) => (props.active ? 'white' : 'var(--text-primary)')};
	border-radius: 12px;
	cursor: ${(props) => (props.active ? 'pointer' : 'default')};
	transition: all 0.2s ease;
	font-weight: 600;

	&:hover {
		transform: ${(props) => (props.active ? 'translateY(-2px)' : 'none')};
		box-shadow: ${(props) => (props.active ? '0 8px 25px rgba(0, 0, 0, 0.15)' : 'none')};
	}
`;

export const Body = styled.div`
	flex: 1;
	margin-bottom: 40px;
`;

export const CampaignCompleteBanner = styled.div`
	background: linear-gradient(135deg, #10b981, #34d399);
	border-radius: 16px;
	padding: 24px;
	margin-bottom: 32px;
	color: white;
	text-align: center;
	box-shadow: 0 8px 32px rgba(16, 185, 129, 0.3);
`;

export const CampaignCompleteContent = styled.div`
	h3 {
		font-size: 1.5rem;
		font-weight: 700;
		margin: 0 0 12px 0;
	}

	p {
		font-size: 1.1rem;
		margin: 0 0 16px 0;
		line-height: 1.5;
	}
`;

export const CurrentTierInfo = styled.div`
	font-size: 1rem;
	font-weight: 600;
	opacity: 0.9;

	strong {
		color: #ffd700;
	}
`;

export const QuestsGrid = styled.div`
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
	gap: 24px;
	margin-bottom: 40px;
`;

export const ProfileRingsSection = styled.div`
	margin-top: 48px;
	padding-top: 32px;
	border-top: 2px solid var(--border-color);
`;

export const ProfileRingsHeader = styled.div`
	text-align: center;
	margin-bottom: 32px;

	h2 {
		font-size: 2rem;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0 0 12px 0;
		background: linear-gradient(135deg, #9d4edd 0%, #c77dff 100%);
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		background-clip: text;
	}

	p {
		font-size: 1.1rem;
		color: var(--text-secondary);
		margin: 0 0 16px 0;
	}
`;

export const CurrentRingIndicator = styled.div`
	font-size: 1.3rem;
	color: var(--text-primary);
	padding: 12px 20px;
	background: var(--background-secondary);
	border-radius: 20px;
	display: inline-block;

	strong {
		color: #9d4edd;
		font-weight: 700;
	}
`;

export const ProfileRingsGrid = styled.div`
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
	gap: 24px;
`;

export const ProfileRingCard = styled.div`
	background: var(--background-primary);
	border: 2px solid var(--border-color);
	border-radius: 16px;
	overflow: hidden;
	transition: all 0.3s ease;
	position: relative;

	&:hover {
		transform: translateY(-4px);
		box-shadow: 0 12px 40px rgba(0, 0, 0, 0.1);
	}
`;

export const ProfileRingPreview = styled.div`
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 32px 24px;
	background: linear-gradient(135deg, var(--background-secondary), var(--background-primary));
	border-radius: 16px;
	box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
`;

export const ProfileRingAvatar = styled.div`
	position: relative;
	width: 100px;
	height: 100px;
	border-radius: 50%;
	overflow: visible;
	margin-bottom: 16px;
	background: linear-gradient(135deg, #374151, #4b5563);
	display: flex;
	align-items: center;
	justify-content: center;
	box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);

	img {
		width: 60%;
		height: 60%;
		object-fit: contain;
		filter: brightness(0.9);
	}
`;

export const ProfileRingBorder = styled.div<{ color: string }>`
	position: absolute;
	top: -8px;
	left: -8px;
	right: -8px;
	bottom: -8px;
	border: 3px solid ${(props) => props.color};
	border-radius: 50%;
	z-index: 1;
	box-shadow: 0 0 30px ${(props) => props.color}80, 0 0 60px ${(props) => props.color}60,
		0 0 90px ${(props) => props.color}40, 0 0 120px ${(props) => props.color}20;
	animation: ringGlow 3s ease-in-out infinite alternate;

	@keyframes ringGlow {
		0% {
			box-shadow: 0 0 30px ${(props) => props.color}80, 0 0 60px ${(props) => props.color}60,
				0 0 90px ${(props) => props.color}40, 0 0 120px ${(props) => props.color}20;
		}
		100% {
			box-shadow: 0 0 40px ${(props) => props.color}90, 0 0 80px ${(props) => props.color}70,
				0 0 120px ${(props) => props.color}50, 0 0 160px ${(props) => props.color}30;
		}
	}
`;

export const ProfileRingBorderInactive = styled.div<{ color: string }>`
	position: absolute;
	top: -4px;
	left: -4px;
	right: -4px;
	bottom: -4px;
	border: 2px solid ${(props) => props.color}60;
	border-radius: 50%;
	z-index: 1;
`;

export const ProfileRingActive = styled.div<{ isActive: boolean }>`
	padding: 6px 16px;
	border-radius: 20px;
	font-size: 0.8rem;
	font-weight: 700;
	color: white;
	background: ${(props) =>
		props.isActive ? 'linear-gradient(135deg, #10b981, #34d399)' : 'linear-gradient(135deg, #6b7280, #9ca3af)'};
	box-shadow: ${(props) =>
		props.isActive ? '0 4px 15px rgba(16, 185, 129, 0.3)' : '0 2px 8px rgba(107, 114, 128, 0.2)'};
	text-transform: uppercase;
	letter-spacing: 0.5px;
`;

export const ProfileRingInfo = styled.div`
	padding: 20px;
`;

export const ProfileRingName = styled.h3`
	font-size: 1.3rem;
	font-weight: 600;
	color: var(--text-primary);
	margin: 0 0 8px 0;
`;

export const ProfileRingDescription = styled.p`
	font-size: 0.9rem;
	color: var(--text-secondary);
	margin: 0 0 12px 0;
	line-height: 1.4;
`;

export const ProfileRingTier = styled.div<{ tier: string }>`
	padding: 4px 8px;
	border-radius: 8px;
	display: flex;
	align-items: center;
	justify-content: center;
`;

export const QuestCard = styled.div<{ completed: boolean; claimed: boolean }>`
	background: var(--background-primary);
	border: 2px solid
		${(props) => {
			if (props.claimed) return '#10b981';
			if (props.completed) return '#3b82f6';
			return 'var(--border-color)';
		}};
	border-radius: 16px;
	padding: 24px;
	transition: all 0.3s ease;
	position: relative;
	overflow: hidden;
	display: flex;
	flex-direction: column;
	min-height: 280px;

	&:hover {
		transform: translateY(-4px);
		box-shadow: 0 12px 40px rgba(0, 0, 0, 0.1);
	}

	&::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 4px;
		background: ${(props) => {
			if (props.claimed) return 'linear-gradient(90deg, #10b981, #34d399)';
			if (props.completed) return 'linear-gradient(90deg, #3b82f6, #60a5fa)';
			return 'var(--border-color)';
		}};
	}
`;

export const QuestHeader = styled.div`
	display: flex;
	align-items: flex-start;
	gap: 16px;
	margin-bottom: 16px;
`;

export const QuestIcon = styled.div`
	width: 56px;
	height: 56px;
	background: var(--background-secondary);
	border-radius: 12px;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;

	img {
		width: 32px;
		height: 32px;
		filter: brightness(0) invert(1);
	}
`;

export const QuestInfo = styled.div`
	flex: 1;
	min-width: 0;
`;

export const QuestTitle = styled.h3`
	font-size: 1.25rem;
	font-weight: 600;
	color: var(--text-primary);
	margin: 0 0 8px 0;
`;

export const QuestDescription = styled.p`
	font-size: 0.9rem;
	color: var(--text-secondary);
	margin: 0 0 8px 0;
	line-height: 1.4;
`;

export const QuestProgress = styled.div`
	font-size: 0.85rem;
	color: var(--text-tertiary);
	font-weight: 500;
`;

export const QuestTier = styled.div<{ tier: string }>`
	padding: 4px 8px;
	border-radius: 8px;
	position: relative;
	display: flex;
	align-items: center;
	justify-content: center;
`;

export const TierMultiplier = styled.div`
	position: absolute;
	top: -8px;
	right: -8px;
	background: linear-gradient(135deg, #10b981, #34d399);
	color: white;
	border-radius: 50%;
	width: 20px;
	height: 20px;
	font-size: 0.6rem;
	font-weight: 700;
	display: flex;
	align-items: center;
	justify-content: center;
	border: 2px solid var(--background-primary);
`;

export const QuestReward = styled.div`
	display: flex;
	align-items: center;
	gap: 12px;
	padding: 12px 16px;
	background: var(--background-secondary);
	border-radius: 12px;
	margin-top: auto;
	margin-bottom: 12px;
`;

export const RewardIcon = styled.div`
	width: 32px;
	height: 32px;
	background: transparent;
	border-radius: 8px;
	display: flex;
	align-items: center;
	justify-content: center;

	img {
		width: 24px;
		height: 24px;
	}
`;

export const RewardText = styled.span`
	font-size: 0.9rem;
	font-weight: 600;
	color: var(--text-primary);
`;

export const TierBoost = styled.div`
	font-size: 0.8rem;
	font-weight: 600;
	color: #10b981;
	margin-top: 4px;
	text-align: center;
`;

export const QuestAction = styled.div`
	display: flex;
	align-items: center;
	justify-content: center;
`;

export const ClaimButton = styled.button`
	background: linear-gradient(135deg, #10b981, #34d399);
	color: white;
	border: none;
	border-radius: 12px;
	padding: 12px 24px;
	font-size: 0.9rem;
	font-weight: 600;
	cursor: pointer;
	transition: all 0.2s ease;
	width: 100%;

	&:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow: 0 8px 25px rgba(16, 185, 129, 0.3);
	}

	&:disabled {
		opacity: 0.7;
		cursor: not-allowed;
	}
`;

export const ClaimedBadge = styled.div`
	display: flex;
	align-items: center;
	gap: 8px;
	color: #10b981;
	font-size: 0.9rem;
	font-weight: 600;

	img {
		width: 16px;
		height: 16px;
		filter: brightness(0) saturate(100%) invert(60%) sepia(100%) saturate(1000%) hue-rotate(80deg) brightness(0.9);
	}
`;

export const DelegationAction = styled.div`
	display: flex;
	flex-direction: column;
	gap: 8px;
`;

export const DelegationButton = styled.button`
	background: linear-gradient(135deg, #9d4edd, #c77dff);
	color: white;
	border: none;
	border-radius: 12px;
	padding: 10px 16px;
	font-size: 0.85rem;
	font-weight: 600;
	cursor: pointer;
	transition: all 0.2s ease;

	&:hover {
		transform: translateY(-2px);
		box-shadow: 0 8px 25px rgba(157, 78, 221, 0.3);
	}
`;

export const DelegationStatus = styled.div`
	font-size: 0.8rem;
	color: var(--text-secondary);
	text-align: center;
`;

export const ProgressBar = styled.div`
	width: 100%;
	height: 8px;
	background: var(--background-secondary);
	border-radius: 4px;
	overflow: hidden;
`;

export const ProgressFill = styled.div<{ progress: number }>`
	height: 100%;
	background: linear-gradient(90deg, #3b82f6, #60a5fa);
	width: ${(props) => Math.min(props.progress, 100)}%;
	transition: width 0.3s ease;
`;

export const Footer = styled.div`
	text-align: center;
	padding: 24px;
	background: var(--background-secondary);
	border-radius: 16px;
	margin-top: auto;

	p {
		font-size: 0.9rem;
		color: var(--text-secondary);
		margin: 0 0 8px 0;
		line-height: 1.5;
	}

	p:first-child {
		font-size: 1.1rem;
		font-weight: 600;
		color: var(--text-primary);
		margin-bottom: 16px;
	}
`;

export const PManageWrapper = styled.div`
	width: 100%;
	max-width: 600px;
`;

// Modal styles
export const MWrapper = styled.div`
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 32px;
	text-align: center;
`;

export const MContentWrapper = styled.div`
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 24px;
	margin-bottom: 24px;
`;

export const AssetTextWrapper = styled.div`
	display: flex;
	flex-direction: column;
	gap: 8px;

	p {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0;
	}

	span {
		font-size: 1rem;
		color: var(--text-secondary);
		margin: 0;
	}
`;

export const RewardDisplay = styled.div`
	display: flex;
	gap: 16px;
	flex-wrap: wrap;
	justify-content: center;
`;

export const RewardItem = styled.div`
	padding: 12px 20px;
	background: linear-gradient(135deg, #ffd700, #ffed4e);
	border-radius: 12px;
	color: #b8860b;
	font-weight: 600;
	font-size: 0.9rem;
`;

export const CampaignRewardDisplay = styled.div`
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 16px;
	padding: 20px;
	background: linear-gradient(135deg, #10b981, #34d399);
	border-radius: 12px;
	color: white;
	text-align: center;
`;

export const CampaignRewardText = styled.div`
	font-size: 1.1rem;
	font-weight: 600;
	line-height: 1.4;
`;

export const CampaignCurrentTier = styled.div`
	font-size: 1rem;
	font-weight: 500;
	opacity: 0.9;

	strong {
		color: #ffd700;
		font-weight: 700;
	}
`;

export const MActionWrapper = styled.div`
	display: flex;
	gap: 12px;

	button {
		padding: 12px 24px;
		background: var(--primary-color);
		color: white;
		border: none;
		border-radius: 8px;
		font-size: 0.9rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s ease;

		&:hover {
			transform: translateY(-2px);
			box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
		}
	}
`;
