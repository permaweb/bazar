import styled, { keyframes } from 'styled-components';

import { openRight } from 'helpers/animations';
import { STYLING } from 'helpers/config';

const float = keyframes`
	0% {
		transform: translateY(0) translateX(0) rotate(0deg);
		opacity: 0;
	}
	20% {
		opacity: 0.8;
	}
	80% {
		opacity: 0.6;
	}
	100% {
		transform: translateY(-20px) translateX(10px) rotate(360deg);
		opacity: 0;
	}
`;

export const Wrapper = styled.header`
	height: ${STYLING.dimensions.nav.height};
	width: 100%;
	position: sticky;
	z-index: 2;
	top: 0;
	background: ${(props) => props.theme.colors.view.background};
`;

export const Content = styled.div`
	height: 100%;
	width: 100%;
	display: flex;
	align-items: center;
	justify-content: space-between;
`;

export const C1Wrapper = styled.div`
	display: flex;
	align-items: center;
`;

export const LogoWrapper = styled.div`
	height: 35px;
	width: 35px;
	position: relative;
	svg {
		height: 35px;
		width: 35px;
		fill: ${(props) => props.theme.colors.icon.alt2.fill};
		&:hover {
			fill: ${(props) => props.theme.colors.icon.alt2.active};
		}
	}
`;

export const AppTag = styled.div`
	display: flex;
	padding: 2.5px 6.5px;
	background: ${(props) => props.theme.colors.container.alt11.background};
	border: 1px solid ${(props) => props.theme.colors.border.alt3};
	border-radius: ${STYLING.dimensions.radius.alt2};

	span {
		font-size: 10px !important;
		font-family: ${(props) => props.theme.typography.family.alt1} !important;
		font-weight: ${(props) => props.theme.typography.weight.bold} !important;
		color: ${(props) => props.theme.colors.font.light1} !important;
		white-space: nowrap;
	}
`;

export const DNavWrapper = styled.div`
	height: 35px;
	display: flex;
	align-items: center;
	margin: 0 0 0 5px;
	padding: 0 0 0 15px;
	> * {
		&:not(:last-child) {
			margin: 0 20px 0 0;
		}
		&:last-child {
			margin: 0;
		}
	}
	a {
		color: ${(props) => props.theme.colors.font.primary};
		font-family: ${(props) => props.theme.typography.family.alt2};
		font-size: ${(props) => props.theme.typography.size.small};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		letter-spacing: 0.25px;

		&:hover {
			color: ${(props) => props.theme.colors.font.alt5};
		}
	}
	@media (max-width: ${STYLING.cutoffs.secondary}) {
		display: none;
	}
`;

export const CampaignButton = styled.a`
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 8px 8px 8px 8px;
    background: rgb(26, 26, 26);	
	color: #fff;
	border-radius: 8px;
	font-family: ${(props) => props.theme.typography.family.alt1};
	font-size: ${(props) => props.theme.typography.size.xxSmall};
	font-weight: ${(props) => props.theme.typography.weight.regular};
	text-decoration: none;
	white-space: nowrap;
	cursor: pointer;
	transition: opacity 0.2s ease;
	position: relative;
	overflow: hidden;


	@media (max-width: 720px) {
		span {
		    padding: 0px 0px 0px 0px !important;
			display: none !important;
		}
	}

	
	&:hover {
		opacity: 0.8;
		color: #fff; !important
	}

    &:active {
		transform: scale(0.98);
		transition: transform 150ms ease-out;
	}

	@media (max-width: ${STYLING.cutoffs.secondary}) {
		display: flex;
	}
`;

export const Particle = styled.div<{ delay: number; top: number; left: number }>`
	position: absolute;
	width: 3px;
	height: 4px;
	background: rgba(255, 255, 255, 0.9);
	clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
	pointer-events: none;
	top: ${(props) => props.top}%;
	left: ${(props) => props.left}%;
	animation: ${float} 3s infinite linear;
	animation-delay: ${(props) => props.delay}s;
	opacity: 0;
`;

export const CampaignIcon = styled.div`
	display: flex;
	align-items: center;
	justify-content: center;
	height: 24px;
	width: 24px;

	svg {
		height: 100%;
		width: 100%;
		fill: #fff;
		transform: translateY(2px);
	}
	@media (max-width: 720px) {
		height: 16px;
		width: 16px;
	}
`;

export const ActionsWrapper = styled.div`
	display: flex;
	align-items: center;
	gap: 20px;
`;

export const DelegationButtonWrapper = styled.div`
	display: flex;
	align-items: center;
`;

export const SettingsButtonWrapper = styled.div`
	display: flex;
	align-items: center;
	@media (max-width: ${STYLING.cutoffs.secondary}) {
		display: none;
	}
`;

export const DelegationButton = styled.button`
	height: 35px;
	padding: 0 17.5px;
	background: ${(props) => props.theme.colors.container.primary.background};
	border: 1px solid ${(props) => props.theme.colors.border.primary};
	border-radius: ${STYLING.dimensions.radius.primary};
	color: ${(props) => props.theme.colors.font.primary};
	font-family: ${(props) => props.theme.typography.family.alt1};
	font-size: ${(props) => props.theme.typography.size.small};
	font-weight: ${(props) => props.theme.typography.weight.bold};
	cursor: pointer;
	transition: all 0.2s ease;

	&:hover {
		background: ${(props) => props.theme.colors.container.primary.active};
	}
`;

export const MessageWrapper = styled.div`
	@media (max-width: ${STYLING.cutoffs.secondary}) {
		display: none;
	}
`;

export const MWrapper = styled.div`
	display: none;
	@media (max-width: ${STYLING.cutoffs.secondary}) {
		display: block;
	}
	button {
		background: transparent;
	}
`;

export const PWrapper = styled.div`
	height: calc(100dvh - 15px);
	width: 400px;
	max-width: 85vw;
	position: fixed;
	top: 10px;
	right: 10px;
	transition: width 50ms ease-out;
	animation: ${openRight} 200ms;
`;

export const PMenu = styled.div``;

export const PHeader = styled.div`
	width: 100%;
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 10px 15px;
	border-bottom: 1px solid ${(props) => props.theme.colors.border.primary};
	svg {
		fill: ${(props) => props.theme.colors.icon.primary.fill};
	}
	h4 {
		font-size: ${(props) => props.theme.typography.size.xLg};
	}
`;

export const MNavWrapper = styled.div`
	display: flex;
	flex-direction: column;
	a {
		color: ${(props) => props.theme.colors.font.primary};
		font-family: ${(props) => props.theme.typography.family.primary};
		font-size: ${(props) => props.theme.typography.size.small};
		font-weight: ${(props) => props.theme.typography.weight.xBold};
		padding: 15px;
		&:hover {
			color: ${(props) => props.theme.colors.font.primary};
			background: ${(props) => props.theme.colors.container.primary.active};
		}
	}
	> * {
		border-bottom: 1px solid ${(props) => props.theme.colors.border.primary};
	}
`;

export const PAction = styled.div`
	height: 35px;
	display: flex;
	align-items: center;
	justify-content: center;
	a {
		height: 100%;
		width: 100%;
		color: ${(props) => props.theme.colors.font.primary};
		font-family: ${(props) => props.theme.typography.family.alt1};
		font-size: ${(props) => props.theme.typography.size.small};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		background: ${(props) => props.theme.colors.container.primary.background};
		border-radius: ${STYLING.dimensions.radius.primary};
		padding: 0 15px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(180deg, #80f154, #bbe948, #efe13e);
		border: 1px solid #80f154;
		color: #0d3f0a;
		font-weight: ${(props) => props.theme.typography.weight.xBold};
		font-size: ${(props) => props.theme.typography.size.base};
		font-family: 'Frank Ruhl Libre', serif;
	}

	svg {
		height: 15px;
		width: 15px;
		margin: 7.5px 7.5px 0 0;
	}

	&:hover {
		a {
			background: rgba(30, 30, 30, 1);
			border: 1px solid #7ec9bf;
			box-shadow: none;
			color: #7ec9bf;
		}
	}

	@media (max-width: ${STYLING.cutoffs.initial}) {
		display: none;
	}
`;
