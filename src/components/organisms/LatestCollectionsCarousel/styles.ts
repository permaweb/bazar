import styled from 'styled-components';

import { fadeIn1, open } from 'helpers/animations';
import { STYLING } from 'helpers/config';

export const Wrapper = styled.div`
	width: 100%;
	margin: 0 0 40px 0;
`;

export const Header = styled.div`
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin: 0 0 20px 0;
	h4 {
		font-size: 24px;
		font-weight: 700;
		color: ${(props) => props.theme.colors.font.primary};
	}
`;

export const HeaderActions = styled.div`
	display: flex;
	align-items: center;
	gap: 10px;
`;

export const CollectionsWrapper = styled.div<{ previousDisabled: boolean }>`
	margin: 0 -10px;

	.react-multiple-carousel__arrow {
		height: calc(100% - 20px);
		width: 50px;
		border-radius: 0;
		z-index: 1;
		background: ${(props) => props.theme.colors.overlay.alt2};
		box-shadow: 0 5px 5px 0 ${(props) => props.theme.colors.container.alt8.background};
		border: 1px solid ${(props) => props.theme.colors.border.primary};
		border-radius: ${STYLING.dimensions.radius.primary};
		animation: ${open} ${fadeIn1};
		transition: all 100ms;
		display: none;

		&:before {
			font-weight: 900;
			content: '';
		}

		&:after {
			font-weight: 900;
			content: '›';
			font-size: 40px;
			color: ${(props) => props.theme.colors.font.light1};
		}
	}
	.react-multiple-carousel__arrow--left {
		left: 22.5px;
		&:after {
			content: '‹';
		}
	}
	.react-multiple-carousel__arrow--right {
		right: 22.5px;
	}

	&:hover {
		.react-multiple-carousel__arrow {
			display: block;
			transition: all 100ms;
		}
		.react-multiple-carousel__arrow--left {
			left: 22.5px;
			display: ${(props) => (props.previousDisabled ? 'none' : 'block')} !important;
		}
	}
`;

export const CollectionWrapper = styled.div<{ backgroundImage: string | null; disabled?: boolean }>`
	width: 300px;
	height: 200px;
	margin: 0 10px;
	border-radius: ${STYLING.dimensions.radius.primary};
	background: ${(props) =>
		props.backgroundImage
			? `linear-gradient(180deg, rgba(0, 0, 0, 0.1) 0%, rgba(0, 0, 0, 0.8) 100%), url(${props.backgroundImage})`
			: props.theme.colors.container.alt1.background};
	background-size: cover;
	background-position: center;
	background-repeat: no-repeat;
	position: relative;
	cursor: ${(props) => (props.disabled ? 'default' : 'pointer')};
	transition: all 200ms;
	opacity: ${(props) => (props.disabled ? 0.5 : 1)};

	&:hover {
		transform: ${(props) => (props.disabled ? 'none' : 'scale(1.02)')};
		box-shadow: ${(props) =>
			props.disabled ? 'none' : `0 10px 20px 0 ${props.theme.colors.container.alt8.background}`};
	}
`;

export const InfoWrapper = styled.div`
	position: absolute;
	bottom: 0;
	left: 0;
	right: 0;
	padding: 20px;
	background: linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.8) 100%);
	border-radius: 0 0 ${STYLING.dimensions.radius.primary} ${STYLING.dimensions.radius.primary};
`;

export const InfoTile = styled.div`
	display: flex;
	flex-direction: column;
	gap: 5px;
`;

export const InfoDetail = styled.div`
	font-size: 18px;
	font-weight: 600;
	color: ${(props) => props.theme.colors.font.light1};
	line-height: 1.2;
`;

export const InfoDetailAlt = styled.div`
	font-size: 14px;
	font-weight: 400;
	color: ${(props) => props.theme.colors.font.light2};
	line-height: 1.3;
	overflow: hidden;
	text-overflow: ellipsis;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
`;
