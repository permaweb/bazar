import React from 'react';
import { ReactSVG } from 'react-svg';
import styled from 'styled-components';

import { ASSETS, STYLING } from 'helpers/config';
import { useArweaveProvider } from 'providers/ArweaveProvider';
import { useLanguageProvider } from 'providers/LanguageProvider';

const ACCENT_COLOR = '#5AF650';
const SHADOW_COLOR = 'rgba(90, 246, 80, 0.5)';

// Typography constants
const typography = {
	family: {
		primary: "'Frank Ruhl Libre', serif",
		alt1: 'Quantico, sans-serif',
	},
	weight: {
		regular: 400,
		medium: 500,
		bold: 700,
		xBold: 900,
	},
	size: {
		base: '16px',
		lg: '18px',
		xLg: '24px',
	},
};

export const Wrapper = styled.div`
	min-height: calc(100vh - (${STYLING.dimensions.nav.height} + 20px));
	width: 100%;
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 40px 20px;
	position: relative;
	overflow: hidden;
	background: linear-gradient(
		180deg,
		rgb(37 37 37),
		rgb(26 26 26),
		rgb(9 9 9),
		rgb(16 16 16),
		rgb(28 28 28),
		rgb(31 31 31)
	) !important;
`;

export const Header = styled.div`
	width: 100%;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 20px;
	margin-bottom: 40px;
`;

export const HeaderMain = styled.div`
	h1 {
		color: #ffffff;
		font-size: 32px;
		font-weight: 700;
		font-family: Inter;
		text-align: center;
	}
`;

export const Subheader = styled.div`
	p {
		color: #ffffff;
		font-size: 16px;
		text-align: center;
		max-width: 600px;
		margin: 0 auto;
	}
`;

export const ViewAction = styled.div`
	margin: 30px 0;
	position: relative;
	z-index: 1;

	button {
		background: rgba(15, 15, 15, 0.9);
		padding: 12px 25px;
		border: 2px solid ${ACCENT_COLOR};
		border-radius: ${STYLING.dimensions.radius.alt2};
		display: flex;
		align-items: center;
		gap: 15px;
		transition: all 200ms ease;
		box-shadow: 0 0 10px ${SHADOW_COLOR};

		span {
			color: ${ACCENT_COLOR};
			font-family: ${(props) => props.theme.typography.family.alt1};
			font-weight: ${(props) => props.theme.typography.weight.bold};
			font-size: ${(props) => props.theme.typography.size.lg};
			text-transform: uppercase;
			letter-spacing: 1px;
		}

		&:hover:not(:disabled) {
			background: rgba(30, 30, 30, 0.9);
			transform: translateY(-2px);
			box-shadow: 0 0 20px ${SHADOW_COLOR};
		}

		&:disabled {
			opacity: 0.5;
			cursor: not-allowed;
			box-shadow: none;
		}
	}
`;

export const SyncAction = styled(ViewAction)`
	margin: 30px 0 0 0;

	button {
		background: rgba(10, 10, 10, 0.65);
		padding: 10px 20px;
		border: 1px solid ${ACCENT_COLOR};
		box-shadow: none;
		border-radius: ${STYLING.dimensions.radius.alt2};
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 15px;
		pointer-events: auto;
		transition: all 100ms;

		span {
			color: ${ACCENT_COLOR};
			font-weight: ${(props) => props.theme.typography.weight.bold};
			font-size: ${(props) => props.theme.typography.size.lg};
			font-family: ${(props) => props.theme.typography.family.alt1};
		}

		&:hover {
			cursor: pointer;
			background: rgba(30, 30, 30, 0.65);
		}

		&:disabled {
			cursor: default;
			pointer-events: none;
		}
	}
`;

export const ProfileWrapper = styled.div<{ active: boolean }>`
	max-width: 90%;
	background: rgba(10, 10, 10, 0.85);
	padding: 15px 25px;
	border: 2px solid ${ACCENT_COLOR};
	border-radius: ${STYLING.dimensions.radius.alt2};
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 15px;
	pointer-events: ${(props) => (props.active ? 'none' : 'auto')};
	transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
	box-shadow: 0 0 15px ${SHADOW_COLOR};

	span {
		color: ${ACCENT_COLOR};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		font-size: ${(props) => props.theme.typography.size.lg};
		font-family: ${(props) => props.theme.typography.family.alt1};
		text-align: center;
	}

	&:hover {
		cursor: ${(props) => (props.active ? 'default' : 'pointer')};
		background: ${(props) => (props.active ? 'rgba(10, 10, 10, 0.85)' : 'rgba(30, 30, 30, 0.85)')};
		transform: ${(props) => (props.active ? 'none' : 'translateY(-2px)')};
	}
`;

export const ProfileIndicator = styled.div<{ active: boolean }>`
	width: 17.5px;
	height: 17.5px;
	background: ${(props) => (props.active ? ACCENT_COLOR : props.theme.colors.warning.primary)};
	border-radius: 50%;
	box-shadow: 0 0 10px ${(props) => (props.active ? SHADOW_COLOR : 'rgba(255, 193, 7, 0.5)')};
	transition: all 0.2s ease;

	&:hover {
		transform: scale(1.1);
	}
`;

export const Body = styled.div`
	width: 100%;
	display: flex;
	gap: 70px;
	margin: 60px 0 0 0;
	flex-wrap: wrap;
	justify-content: center;
	align-items: center;
	position: relative;
	z-index: 1;
`;

export const GridElement = styled.div<{ claimable: boolean; claimed: boolean }>`
	position: relative;
	border-radius: 12.5px;
	transition: transform 200ms;

	img {
		width: 100%;
		border-radius: 10px;
	}
`;

export const GridElementOverlay = styled.div`
	position: absolute;
	top: 0;
	left: 0;
	right: 0;
	bottom: 0;
	display: flex;
	justify-content: center;
	align-items: center;
	background: rgba(10, 10, 10, 0.75);
	border-radius: 10px;

	svg {
		height: 185px;
		width: 185px;
		color: #d7d7d2;
		opacity: 0.8;
	}
`;

export const GridElementAction = styled.button`
	width: calc(100% - 40px);
	padding: 12px 25px;
	border-radius: ${STYLING.dimensions.radius.primary};
	background: ${ACCENT_COLOR};
	border: 2px solid ${ACCENT_COLOR};
	box-shadow: 0 0 15px ${SHADOW_COLOR};
	transition: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
	position: relative;
	overflow: hidden;

	&::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: linear-gradient(45deg, transparent, rgba(255, 255, 255, 0.1), transparent);
		transform: translateX(-100%);
		transition: transform 500ms ease;
	}

	span {
		color: #272727;
		font-weight: ${(props) => props.theme.typography.weight.xBold};
		font-size: ${(props) => props.theme.typography.size.xLg};
		font-family: ${(props) => props.theme.typography.family.alt1};
		position: relative;
		z-index: 1;
	}

	&:hover:not(:disabled) {
		background: transparent;
		transform: translateY(-2px);

		span {
			color: ${ACCENT_COLOR};
		}

		&::before {
			transform: translateX(100%);
		}
	}

	&:disabled {
		background: #666666;
		border-color: #666666;
		box-shadow: none;
		cursor: not-allowed;

		span {
			color: #999999;
		}
	}
`;

export const GridElementInfoWrapper = styled.div`
	width: 100%;
	margin: 20px 0 0 0;

	a {
		font-weight: ${(props) => props.theme.typography.weight.bold};
		font-size: ${(props) => props.theme.typography.size.base};
		font-family: ${(props) => props.theme.typography.family.alt1};
		background: rgba(10, 10, 10, 0.85);
		color: ${ACCENT_COLOR};
		text-decoration: underline;
		text-decoration-thickness: 1.5px;
		pointer-events: all !important;
		border: 2px solid ${ACCENT_COLOR};
		padding: 15px;
		border-radius: ${STYLING.dimensions.radius.alt2};
		min-height: 85px;
		display: flex;
		justify-content: center;
		align-items: center;
		text-align: center;
		transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
		box-shadow: 0 0 10px ${SHADOW_COLOR};

		&:hover {
			background: rgba(30, 30, 30, 0.85);
			transform: translateY(-2px);
			box-shadow: 0 0 15px ${SHADOW_COLOR};
		}
	}
`;

export const PrimaryAssetWrapper = styled.div`
	width: 100%;
	max-width: 1200px;
	display: flex;
	flex-direction: column;
	gap: 30px;
	align-items: center;
	justify-content: center;
	margin: 40px 0;
`;

export const PrimaryAsset = styled(GridElement)`
	max-width: 800px;

	img,
	video {
		box-shadow: 0 0 25px ${SHADOW_COLOR};
	}
`;

export const PrimaryAssetOverlay = styled(GridElementOverlay)`
	height: 100%;
	background: rgba(15, 15, 15, 0.75);
	backdrop-filter: blur(5px);
	border: 2px solid ${ACCENT_COLOR};

	svg {
		height: 250px;
		width: 250px;
		color: ${ACCENT_COLOR};
		opacity: 0.9;
		filter: drop-shadow(0 0 10px ${SHADOW_COLOR});
	}
`;

export const AssetTextWrapper = styled.div`
	width: 100%;
	max-width: 600px;
	display: flex;
	flex-direction: column;
	gap: 15px;
	justify-content: center;
	align-items: center;
	border: 2px solid ${ACCENT_COLOR};
	background: rgba(10, 10, 10, 0.85);
	padding: 20px 40px;
	border-radius: ${STYLING.dimensions.radius.alt2};
	box-shadow: 0 0 15px ${SHADOW_COLOR};

	p {
		color: ${ACCENT_COLOR};
		font-size: 32px;
		font-weight: ${(props) => props.theme.typography.weight.xBold};
		font-family: ${(props) => props.theme.typography.family.alt1};
		text-align: center;
		text-shadow: 0 0 10px ${SHADOW_COLOR};
	}

	span {
		color: ${ACCENT_COLOR};
		font-size: ${(props) => props.theme.typography.size.lg};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		font-family: ${(props) => props.theme.typography.family.alt1};
		text-align: center;
	}
`;

export const BodyLoading = styled.div`
	width: 100%;
	display: flex;
	flex-direction: column;
	gap: 20px;
	justify-content: center;
	align-items: center;
	margin: 40px 0;

	span {
		color: #d3d3d3;
		text-shadow: 0 0 20px #d3d3d3;
		font-weight: ${(props) => props.theme.typography.weight.medium};
		font-size: ${(props) => props.theme.typography.size.xLg};
		font-family: ${(props) => props.theme.typography.family.alt1};
	}

	img {
		height: 250px;
		filter: drop-shadow(0 0 10px rgba(211, 211, 211, 0.5));
	}
`;

export const PManageWrapper = styled.div`
	max-width: 550px;
`;

export const MWrapper = styled.div<{ primaryAsset: boolean }>`
	width: 100%;
	display: flex;
	flex-direction: column;
	justify-content: center;
	align-items: center;
	position: relative;
	overflow: hidden;
	padding: 80px 20px 20px 20px;
	background: linear-gradient(
		180deg,
		rgb(37 37 37),
		rgb(26 26 26),
		rgb(9 9 9),
		rgb(16 16 16),
		rgb(28 28 28),
		rgb(31 31 31)
	);
	border: 1.5px solid #1fd014;
	border-radius: ${STYLING.dimensions.radius.primary};
	img,
	video {
		width: 100%;
		border: 1.5px solid #1fd014;
		box-shadow: 0px 0px 10px 3.5px #5af650;
		border-radius: 12.5px;
	}
`;

export const MContentWrapper = styled.div`
	width: 100%;
	display: flex;
	flex-direction: column;
	gap: 30px;
	justify-content: center;
	align-items: center;
	position: relative;
	z-index: 1;
`;

export const MActionWrapper = styled.div`
	position: absolute;
	top: 20px;
	right: 20px;
	button {
		font-size: ${(props) => props.theme.typography.size.xSmall};
		font-weight: ${(props) => props.theme.typography.weight.xBold};
		font-family: ${(props) => props.theme.typography.family.alt1};
		background: transparent;
		border: 1px solid #c0c0c0;
		color: #c0c0c0;
		padding: 5px 10px;
		border-radius: ${STYLING.dimensions.radius.alt2};
		transition: all 175ms;
		&:hover {
			cursor: pointer;
			color: #fff;
			border: 1px solid #fff;
		}
	}
`;

export const AudioWrapper = styled.div`
	position: absolute;
	top: 15px;
	right: 15px;
	z-index: 1;
	button {
		height: 30px;
		width: 30px;
		font-size: ${(props) => props.theme.typography.size.xSmall};
		font-weight: ${(props) => props.theme.typography.weight.xBold};
		font-family: ${(props) => props.theme.typography.family.alt1};
		background: transparent;
		border: 1px solid #c0c0c0;
		color: #c0c0c0;
		border-radius: 50%;
		transition: all 175ms;

		svg {
			height: 12.5px;
			width: 12.5px;
			margin: 4.5px 0 0 0;
			color: #c0c0c0;
			fill: #c0c0c0;
		}

		&:hover {
			color: #fff;
			border: 1px solid #fff;
			svg {
				color: #fff;
				fill: #fff;
			}
		}
	}
`;

export const Footer = styled.div`
	width: fit-content;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	margin: 60px 0 0 0;
	position: relative;
	z-index: 1;

	p {
		line-height: 1.55;
		max-width: 800px;
		color: ${(props) => props.theme.colors.font.light2};
		font-size: ${(props) => props.theme.typography.size.base};
		font-weight: ${(props) => props.theme.typography.weight.medium};
		font-family: ${(props) => props.theme.typography.family.alt1};
		text-align: left;
	}
`;

export const BlockWrapper = styled.div`
	max-width: 90%;
	display: flex;
	flex-direction: column;
	justify-content: center;
	align-items: center;
	gap: 20px;
	margin: 40px auto;

	a {
		padding: 5px 10px;
		font-size: ${(props) => props.theme.typography.size.xSmall};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		background: transparent;
		border: 1px solid #000;
		color: #000;
		border-radius: 5px;
		transition: all 175ms;

		&:hover {
			color: #444;
			border: 1px solid #444;
		}
	}
`;

export const ClaimsWrapper = styled(AssetTextWrapper)`
	margin: 50px 0 0 0;
`;

export const BlockMessage = styled.div`
	p {
		color: ${(props) => props.theme.colors.font.primary};
		font-size: ${(props) => props.theme.typography.size.base};
		font-weight: ${(props) => props.theme.typography.weight.regular};
		font-family: ${(props) => props.theme.typography.family.primary};
		text-transform: uppercase;
		text-align: center;
		line-height: 1.65;
	}
`;

export const CollectionInfo = styled.div`
	width: 455.5px;
	height: 83px;
	padding: 0 16px;
	overflow: hidden;
	border-radius: 16px;
	background: #f1f1f1;
	display: flex;
	align-items: center;
	justify-content: space-between;
`;

export const InfoText = styled.div`
	display: flex;
	flex-direction: column;
	gap: 16px;

	h3 {
		color: #262a1a;
		font-size: 16px;
		font-weight: 700;
		font-family: Inter;
		line-height: 1.4;
		white-space: nowrap;
	}

	span {
		color: #262a1a;
		font-size: 13px;
		font-family: Inter;
		line-height: 1.4;
		white-space: nowrap;
	}
`;

export const ConnectButton = styled.button`
	background: rgba(15, 15, 15, 0.9);
	padding: 12px 25px;
	border: 2px solid ${ACCENT_COLOR};
	border-radius: ${STYLING.dimensions.radius.alt2};
	margin-top: 15px;
	transition: all 200ms ease;

	span {
		color: ${ACCENT_COLOR};
		font-family: ${(props) => props.theme.typography.family.alt1};
		font-weight: ${(props) => props.theme.typography.weight.bold};
	}

	&:hover {
		background: rgba(30, 30, 30, 0.9);
		transform: translateY(-2px);
		box-shadow: 0 0 15px ${SHADOW_COLOR};
	}
`;

export const WalletOverlay = styled.div`
	position: absolute;
	width: 503.5px;
	height: 438px;
	left: 50%;
	top: 50%;
	transform: translate(-50%, -50%);
	z-index: 38;
	border-radius: 16px;
	background: #ffffff;
	display: flex;
	justify-content: center;
	align-items: center;
	padding: 32px;
	text-align: center;
`;

export const OverlayContent = styled.div`
	max-width: 450px;
	width: 90%;
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 25px;
	text-align: center;
	padding: 30px;

	h2 {
		color: ${ACCENT_COLOR};
		font-family: ${(props) => props.theme.typography.family.alt1};
		font-size: ${(props) => props.theme.typography.size.xLg};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		text-transform: uppercase;
	}

	p {
		color: ${(props) => props.theme.colors.font.light1};
		font-size: ${(props) => props.theme.typography.size.lg};
		line-height: 1.5;

		a {
			color: ${ACCENT_COLOR};
			text-decoration: underline;

			&:hover {
				opacity: 0.8;
			}
		}
	}
`;

export const ConnectWalletButton = styled.button`
	background: #1a1a1a;
	color: white;
	padding: 12px 24px;
	border-radius: 9999px;
	border: none;
	font-size: 14px;
	cursor: pointer;
	transition: background 100ms ease-out;

	&:active {
		scale: 0.97;
		transition: scale 300ms ease-out;
	}
	&:hover {
		background: #333;
	}
`;

export const Frame = styled.div`
	width: 1487px;
	height: 871px;
	position: relative;
	z-index: 40;
	overflow: hidden;
	border-radius: 16px;
	background: rgba(0, 0, 0, 0.5);
	display: flex;
`;

export const Text = styled.span`
	color: #ffffff;
	font-size: 12px;
	font-weight: 700;
	font-family: Inter;
	line-height: 1.4;
	white-space: nowrap;
`;

export const frame_0 = styled.div`
	width: 1512px;
	height: 982px;
	padding-bottom: 12px;
	z-index: 42;
	overflow: hidden;
	background: #ffffff;
	display: flex;
	align-items: center;
	flex-direction: column;
`;

export const rectangle_1 = styled.img`
	width: 1511px;
	height: 75px;
	display: flex;
`;

export const frame_2 = styled.div`
	width: 1511px;
	height: 895px;
	overflow: hidden;
	display: flex;
	justify-content: center;
	align-items: center;
`;

export const frame_3 = styled.div`
	width: 1487px;
	height: 871px;
	position: relative;
	z-index: 40;
	overflow: hidden;
	border-radius: 16px;
	background: rgba(0, 0, 0, 0.5);
	display: flex;
`;

export const frame_4 = styled.div`
	width: 743.5px;
	height: 873px;
	top: -1px;
	position: absolute;
	z-index: 12;
	overflow: hidden;
	background: #f1f1f1;
	display: flex;
	justify-content: center;
`;

export const text_37 = styled.span`
	width: 91px;
	height: 15px;
	color: #ffffff;
	font-size: 12px;
	font-weight: 700;
	font-family: Inter;
	line-height: 1.4;
	white-space: nowrap;
`;

export const LoadingWrapper = styled.div`
	width: 503.5px;
	height: 438px;
	background: #fff;
	border-radius: 16px;
	box-shadow: 0 4px 32px rgba(0, 0, 0, 0.18);
	display: flex;
	flex-direction: column;
	justify-content: center;
	align-items: center;
	padding: 0;
	overflow: hidden;
`;

export const LoadingContent = styled.div`
	background: #f1f1f1;
	border-radius: 12px;
	margin: 8px;
	padding: 16px;
	height: calc(100% - 16px);
	width: calc(100% - 16px);
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
`;

export const LoadingSpinner = styled.div`
	width: 48px;
	height: 48px;
	border: 3px solid #000;
	border-top-color: transparent;
	border-radius: 50%;
	animation: spin 1s linear infinite;
	margin-bottom: 24px;

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}
`;

export const LoadingText = styled.span`
	color: #262a1a;
	font-size: 18px;
	font-weight: 700;
	font-family: Inter;
	text-align: center;
`;

export const LoadingSubtext = styled.span`
	color: #262a1a;
	font-size: 14px;
	font-family: Inter;
	text-align: center;
	margin-top: 8px;
	max-width: 300px;
`;
