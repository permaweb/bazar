import styled from 'styled-components';

import { STYLING } from 'helpers/config';

export const Wrapper = styled.div`
	width: 100%;
	max-width: ${STYLING.cutoffs.max};
	margin: 0 auto;
	padding: 40px 20px;
`;

export const Header = styled.div`
	margin-bottom: 40px;
	text-align: center;
`;

export const Title = styled.h1`
	font-size: clamp(28px, 4vw, 38px);
	font-family: ${(props) => props.theme.typography.family.primary};
	font-weight: ${(props) => props.theme.typography.weight.bold};
	color: ${(props) => props.theme.colors.font.primary};
	margin: 0 0 10px 0;
`;

export const Subtitle = styled.p`
	font-size: ${(props) => props.theme.typography.size.base};
	font-family: ${(props) => props.theme.typography.family.primary};
	color: ${(props) => props.theme.colors.font.alt1};
	margin: 0;
`;

// Steps Progress Bar
export const StepsContainer = styled.div`
	display: flex;
	align-items: center;
	justify-content: center;
	margin: 40px auto;
	max-width: 800px;
	padding: 0 20px;

	@media (max-width: ${STYLING.cutoffs.tablet}) {
		flex-direction: column;
		gap: 0;
	}
`;

export const Step = styled.div<{ status: 'pending' | 'active' | 'completed' }>`
	display: flex;
	align-items: center;
	gap: 12px;
	opacity: ${(props) => (props.status === 'pending' ? 0.5 : 1)};

	@media (max-width: ${STYLING.cutoffs.tablet}) {
		width: 100%;
		padding: 15px;
	}
`;

export const StepNumber = styled.div<{ status: 'pending' | 'active' | 'completed' }>`
	width: 45px;
	height: 45px;
	border-radius: 50%;
	display: flex;
	align-items: center;
	justify-content: center;
	font-family: ${(props) => props.theme.typography.family.primary};
	font-size: ${(props) => props.theme.typography.size.lg};
	font-weight: ${(props) => props.theme.typography.weight.bold};
	flex-shrink: 0;

	background: ${(props) =>
		props.status === 'completed'
			? props.theme.colors.success
			: props.status === 'active'
			? props.theme.colors.button.primary.background
			: props.theme.colors.container.alt3.background};

	color: ${(props) => (props.status === 'pending' ? props.theme.colors.font.alt1 : props.theme.colors.font.primary)};

	border: 2px solid
		${(props) => (props.status === 'active' ? props.theme.colors.button.primary.background : 'transparent')};
`;

export const StepContent = styled.div`
	display: flex;
	flex-direction: column;
	gap: 4px;
`;

export const StepTitle = styled.div`
	font-family: ${(props) => props.theme.typography.family.primary};
	font-size: ${(props) => props.theme.typography.size.base};
	font-weight: ${(props) => props.theme.typography.weight.bold};
	color: ${(props) => props.theme.colors.font.primary};
`;

export const StepDesc = styled.div`
	font-family: ${(props) => props.theme.typography.family.primary};
	font-size: ${(props) => props.theme.typography.size.xSmall};
	color: ${(props) => props.theme.colors.font.alt1};
`;

export const StepConnector = styled.div<{ status: 'pending' | 'active' | 'completed' }>`
	height: 2px;
	width: 60px;
	background: ${(props) =>
		props.status === 'completed' || props.status === 'active'
			? props.theme.colors.button.primary.background
			: props.theme.colors.border.alt1};
	margin: 0 10px;
	flex-shrink: 0;

	@media (max-width: ${STYLING.cutoffs.tablet}) {
		width: 2px;
		height: 30px;
		margin: 0 0 0 22px;
	}
`;

// Step Sections
export const StepSection = styled.section<{ active?: boolean }>`
	margin-bottom: 40px;
	opacity: ${(props) => (props.active === false ? 0.6 : 1)};
	transition: opacity 0.3s ease;
`;

export const SectionTitle = styled.h2`
	font-size: clamp(20px, 3vw, 24px);
	font-family: ${(props) => props.theme.typography.family.primary};
	font-weight: ${(props) => props.theme.typography.weight.bold};
	color: ${(props) => props.theme.colors.font.primary};
	margin: 0 0 20px 0;
`;

export const WalletGrid = styled.div`
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
	gap: 20px;

	@media (max-width: ${STYLING.cutoffs.tablet}) {
		grid-template-columns: 1fr;
	}
`;

export const WalletCard = styled.div`
	background: ${(props) => props.theme.colors.container.primary.background};
	border: 1px solid ${(props) => props.theme.colors.border.primary};
	border-radius: ${STYLING.dimensions.borderRadiusWrapper};
	padding: 20px;
`;

export const WalletCardHeader = styled.div`
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 15px;
`;

export const WalletCardTitle = styled.h3`
	font-size: ${(props) => props.theme.typography.size.lg};
	font-family: ${(props) => props.theme.typography.family.primary};
	font-weight: ${(props) => props.theme.typography.weight.bold};
	color: ${(props) => props.theme.colors.font.primary};
	margin: 0;
`;

export const OptionalBadge = styled.span`
	background: ${(props) => props.theme.colors.button.alt2.background};
	color: ${(props) => props.theme.colors.font.primary};
	padding: 4px 10px;
	border-radius: 12px;
	font-size: ${(props) => props.theme.typography.size.xSmall};
	font-weight: ${(props) => props.theme.typography.weight.bold};
`;

export const WalletCardBody = styled.div`
	display: flex;
	flex-direction: column;
	gap: 12px;
`;

export const ConnectedStatus = styled.div`
	display: flex;
	align-items: center;
	gap: 8px;
`;

export const DisconnectedStatus = styled.div`
	display: flex;
	align-items: center;
	gap: 8px;
`;

export const StatusIcon = styled.span`
	font-size: 20px;
`;

export const StatusText = styled.span`
	font-size: ${(props) => props.theme.typography.size.base};
	font-family: ${(props) => props.theme.typography.family.primary};
	font-weight: ${(props) => props.theme.typography.weight.medium};
	color: ${(props) => props.theme.colors.font.primary};
`;

export const WalletAddress = styled.div`
	font-size: ${(props) => props.theme.typography.size.small};
	font-family: ${(props) => props.theme.typography.family.alt1};
	color: ${(props) => props.theme.colors.font.alt1};
	padding: 8px 12px;
	background: ${(props) => props.theme.colors.container.alt4.background};
	border-radius: 8px;
`;

export const ProfileInfo = styled.div`
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 8px 12px;
	background: ${(props) => props.theme.colors.container.alt3.background};
	border-radius: 8px;
`;

export const ProfileLabel = styled.span`
	font-size: ${(props) => props.theme.typography.size.small};
	font-family: ${(props) => props.theme.typography.family.primary};
	color: ${(props) => props.theme.colors.font.alt1};
`;

export const ProfileName = styled.span`
	font-size: ${(props) => props.theme.typography.size.small};
	font-family: ${(props) => props.theme.typography.family.primary};
	font-weight: ${(props) => props.theme.typography.weight.bold};
	color: ${(props) => props.theme.colors.font.primary};
`;

export const BalanceInfo = styled.div`
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 8px 12px;
	background: ${(props) => props.theme.colors.container.alt3.background};
	border-radius: 8px;
`;

export const BalanceLabel = styled.span`
	font-size: ${(props) => props.theme.typography.size.small};
	font-family: ${(props) => props.theme.typography.family.primary};
	color: ${(props) => props.theme.colors.font.alt1};
`;

export const BalanceAmount = styled.span`
	font-size: ${(props) => props.theme.typography.size.small};
	font-family: ${(props) => props.theme.typography.family.alt1};
	font-weight: ${(props) => props.theme.typography.weight.bold};
	color: ${(props) => props.theme.colors.font.primary};
`;

export const SessionKeyInfo = styled.div`
	display: flex;
	align-items: center;
	gap: 10px;
	padding: 10px 12px;
	background: ${(props) => props.theme.colors.container.alt2.background};
	border: 1px solid ${(props) => props.theme.colors.border.alt1};
	border-radius: 8px;
`;

export const SessionKeyIcon = styled.span`
	font-size: 18px;
`;

export const SessionKeyLabel = styled.div`
	font-size: ${(props) => props.theme.typography.size.small};
	font-family: ${(props) => props.theme.typography.family.primary};
	font-weight: ${(props) => props.theme.typography.weight.medium};
	color: ${(props) => props.theme.colors.font.primary};
`;

export const SessionKeyExpiry = styled.div`
	font-size: ${(props) => props.theme.typography.size.xSmall};
	font-family: ${(props) => props.theme.typography.family.primary};
	color: ${(props) => props.theme.colors.font.alt1};
	margin-top: 2px;
`;

export const WalletDescription = styled.p`
	font-size: ${(props) => props.theme.typography.size.small};
	font-family: ${(props) => props.theme.typography.family.primary};
	color: ${(props) => props.theme.colors.font.alt1};
	margin: 0;
	line-height: 1.5;
`;

export const RainbowButtonWrapper = styled.div`
	button {
		width: 100%;
		justify-content: center;
	}
`;

export const ErrorMessage = styled.div`
	padding: 10px 12px;
	background: ${(props) => props.theme.colors.warning}22;
	border: 1px solid ${(props) => props.theme.colors.warning};
	border-radius: 8px;
	font-size: ${(props) => props.theme.typography.size.small};
	font-family: ${(props) => props.theme.typography.family.primary};
	color: ${(props) => props.theme.colors.warning};
`;

export const InfoBox = styled.div`
	display: flex;
	align-items: flex-start;
	gap: 12px;
	padding: 15px;
	background: ${(props) => props.theme.colors.container.alt2.background};
	border: 1px solid ${(props) => props.theme.colors.border.alt1};
	border-radius: ${STYLING.dimensions.borderRadiusWrapper};
	margin-top: 20px;
`;

export const InfoIcon = styled.span`
	font-size: 24px;
	flex-shrink: 0;
`;

export const InfoText = styled.p`
	font-size: ${(props) => props.theme.typography.size.small};
	font-family: ${(props) => props.theme.typography.family.primary};
	color: ${(props) => props.theme.colors.font.alt1};
	margin: 0;
	line-height: 1.6;
`;

// Bridge Section
export const BridgeCard = styled.div`
	background: ${(props) => props.theme.colors.container.primary.background};
	border: 1px solid ${(props) => props.theme.colors.border.primary};
	border-radius: ${STYLING.dimensions.borderRadiusWrapper};
	padding: 30px;
`;

export const BridgeInfo = styled.div`
	display: flex;
	flex-direction: column;
	gap: 20px;
`;

export const BridgeTitle = styled.h3`
	font-size: ${(props) => props.theme.typography.size.xl};
	font-family: ${(props) => props.theme.typography.family.primary};
	font-weight: ${(props) => props.theme.typography.weight.bold};
	color: ${(props) => props.theme.colors.font.primary};
	margin: 0;
`;

export const BridgeAssetList = styled.div`
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
	gap: 15px;
	margin: 15px 0;
`;

export const BridgeAssetItem = styled.div`
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 8px;
	padding: 15px;
	background: ${(props) => props.theme.colors.container.alt3.background};
	border-radius: ${STYLING.dimensions.borderRadius};
`;

export const AssetIcon = styled.span`
	font-size: 32px;
`;

export const AssetName = styled.span`
	font-size: ${(props) => props.theme.typography.size.small};
	font-family: ${(props) => props.theme.typography.family.primary};
	font-weight: ${(props) => props.theme.typography.weight.medium};
	color: ${(props) => props.theme.colors.font.primary};
`;

export const BridgeDescription = styled.p`
	font-size: ${(props) => props.theme.typography.size.base};
	font-family: ${(props) => props.theme.typography.family.primary};
	color: ${(props) => props.theme.colors.font.alt1};
	margin: 0;
	line-height: 1.6;
`;

export const BridgeFeatures = styled.div`
	display: flex;
	flex-direction: column;
	gap: 12px;
	margin: 10px 0;
`;

export const FeatureItem = styled.div`
	display: flex;
	align-items: center;
	gap: 10px;
`;

export const FeatureIcon = styled.span`
	font-size: 20px;
`;

export const FeatureText = styled.span`
	font-size: ${(props) => props.theme.typography.size.small};
	font-family: ${(props) => props.theme.typography.family.primary};
	color: ${(props) => props.theme.colors.font.alt1};
`;

export const BridgeNote = styled.div`
	padding: 15px;
	background: ${(props) => props.theme.colors.container.alt4.background};
	border-radius: 8px;
	font-size: ${(props) => props.theme.typography.size.small};
	font-family: ${(props) => props.theme.typography.family.primary};
	color: ${(props) => props.theme.colors.font.alt1};
	line-height: 1.5;

	strong {
		color: ${(props) => props.theme.colors.font.primary};
	}
`;

// Delegation Section
export const DelegationCard = styled.div`
	background: ${(props) => props.theme.colors.container.primary.background};
	border: 1px solid ${(props) => props.theme.colors.border.primary};
	border-radius: ${STYLING.dimensions.borderRadiusWrapper};
	padding: 30px;
`;

export const DelegationInfo = styled.div`
	display: flex;
	flex-direction: column;
	gap: 20px;
	align-items: center;
	text-align: center;
`;

export const DelegationTitle = styled.h3`
	font-size: ${(props) => props.theme.typography.size.xl};
	font-family: ${(props) => props.theme.typography.family.primary};
	font-weight: ${(props) => props.theme.typography.weight.bold};
	color: ${(props) => props.theme.colors.font.primary};
	margin: 0;
`;

export const DelegationDescription = styled.p`
	font-size: ${(props) => props.theme.typography.size.base};
	font-family: ${(props) => props.theme.typography.family.primary};
	color: ${(props) => props.theme.colors.font.alt1};
	margin: 0;
	line-height: 1.6;
	max-width: 600px;
`;

export const DelegationFeatures = styled.div`
	display: flex;
	flex-direction: column;
	gap: 12px;
	margin: 10px 0;
	width: 100%;
	max-width: 500px;
`;

export const ComingSoonBadge = styled.div`
	padding: 12px 24px;
	background: ${(props) => props.theme.colors.button.alt1.background};
	color: ${(props) => props.theme.colors.font.primary};
	border-radius: 20px;
	font-size: ${(props) => props.theme.typography.size.base};
	font-family: ${(props) => props.theme.typography.family.primary};
	font-weight: ${(props) => props.theme.typography.weight.bold};
`;

export const LearnMoreLink = styled.a`
	font-size: ${(props) => props.theme.typography.size.base};
	font-family: ${(props) => props.theme.typography.family.primary};
	font-weight: ${(props) => props.theme.typography.weight.medium};
	color: ${(props) => props.theme.colors.button.primary.background};
	text-decoration: none;

	&:hover {
		text-decoration: underline;
	}
`;

// FAQ Section
export const FeatureSection = styled.section`
	margin: 60px 0 40px 0;
`;

export const FaqCard = styled.div`
	background: ${(props) => props.theme.colors.container.primary.background};
	border: 1px solid ${(props) => props.theme.colors.border.primary};
	border-radius: ${STYLING.dimensions.borderRadiusWrapper};
	padding: 25px;
	display: flex;
	flex-direction: column;
	gap: 25px;
`;

export const FaqItem = styled.div`
	padding-bottom: 20px;
	border-bottom: 1px solid ${(props) => props.theme.colors.border.alt1};

	&:last-child {
		padding-bottom: 0;
		border-bottom: none;
	}
`;

export const FaqQuestion = styled.h4`
	font-size: ${(props) => props.theme.typography.size.base};
	font-family: ${(props) => props.theme.typography.family.primary};
	font-weight: ${(props) => props.theme.typography.weight.bold};
	color: ${(props) => props.theme.colors.font.primary};
	margin: 0 0 10px 0;
`;

export const FaqAnswer = styled.p`
	font-size: ${(props) => props.theme.typography.size.small};
	font-family: ${(props) => props.theme.typography.family.primary};
	color: ${(props) => props.theme.colors.font.alt1};
	margin: 0;
	line-height: 1.6;
`;

export const DelegationButtonWrapper = styled.div`
	width: 100%;
	max-width: 400px;
	margin: 10px 0;
`;

export const DelegationNote = styled.div`
	padding: 15px;
	background: ${(props) => props.theme.colors.container.alt4.background};
	border-radius: 8px;
	font-size: ${(props) => props.theme.typography.size.small};
	font-family: ${(props) => props.theme.typography.family.primary};
	color: ${(props) => props.theme.colors.font.alt1};
	line-height: 1.5;
	max-width: 600px;

	strong {
		color: ${(props) => props.theme.colors.font.primary};
	}
`;

export const DelegationPanelWrapper = styled.div`
	position: fixed;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	background: rgba(0, 0, 0, 0.75);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 1000;
	padding: 20px;
`;

export const DelegationPanelContent = styled.div`
	background: ${(props) => props.theme.colors.container.primary.background};
	border: 1px solid ${(props) => props.theme.colors.border.primary};
	border-radius: ${STYLING.dimensions.borderRadiusWrapper};
	padding: 30px;
	max-width: 500px;
	width: 100%;
	display: flex;
	flex-direction: column;
	gap: 20px;
	align-items: center;
	text-align: center;
`;

export const DelegationPanelNote = styled.p`
	font-size: ${(props) => props.theme.typography.size.base};
	font-family: ${(props) => props.theme.typography.family.primary};
	color: ${(props) => props.theme.colors.font.alt1};
	margin: 0;
	line-height: 1.6;
`;

export const ProfileManageWrapper = styled.div`
	width: 100%;
`;
