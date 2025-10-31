import styled from 'styled-components';

import { fadeIn1, open } from 'helpers/animations';
import { STYLING } from 'helpers/config';

export const Wrapper = styled.div``;

export const Header = styled.div`
	display: flex;
	justify-content: space-between;
	align-items: center;
	flex-wrap: wrap;
	gap: 20px;
	margin: 0 0 20px 0;
`;

export const HeaderActions = styled.div`
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 20px;

	button {
		padding: 2.5px 15px 0 15px !important;
	}
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

export const CollectionWrapper = styled.div<{ backgroundImage: string; disabled: boolean }>`
	height: 350px;
	margin: 0 10px;
	overflow: hidden;
	position: relative;
	background-image: ${(props) => `url(${props.backgroundImage})`};
	background-size: cover;
	background-repeat: no-repeat;
	background-position: center;

	img {
		height: 100%;
		width: 100%;
		object-fit: cover;
	}

	${({ disabled, theme }) =>
		!disabled &&
		`
		::after {
			content: '';
			position: absolute;
			height: 100%;
			width: 100%;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			background-color: ${theme.colors.overlay.alt1};
			border-radius: ${STYLING.dimensions.radius.alt2};
			opacity: 0;
			transition: all 100ms;
		}
		&:hover::after, &:focus::after {
			opacity: 1;
		}
	`}

	&:hover {
		cursor: ${({ disabled }) => (disabled ? 'default' : 'pointer')};
	}

	a {
		height: 100%;
		width: 100%;
		display: flex;
		align-items: flex-end;
		position: relative;
		z-index: 1;
	}
`;

export const InfoWrapper = styled.div`
	width: 100%;
	padding: 20px 15px 12.5px 15px;
	background: ${(props) => `linear-gradient(0deg, ${props.theme.colors.overlay.alt1} 0%,transparent)`};
	p,
	span {
		text-shadow: 0 0 5px ${(props) => props.theme.colors.font.dark1};
	}
`;

export const InfoTile = styled.div``;

export const InfoDetail = styled.div`
	display: flex;
	span {
		font-size: ${(props) => props.theme.typography.size.xLg};
		font-family: ${(props) => props.theme.typography.family.alt1};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		color: ${(props) => props.theme.colors.font.light1};
	}
`;

export const InfoDetailAlt = styled.div`
	display: flex;
	margin: 2.5px 0 0 0;
	span {
		font-size: ${(props) => props.theme.typography.size.base};
		font-family: ${(props) => props.theme.typography.family.primary};
		font-weight: ${(props) => props.theme.typography.weight.medium};
		color: ${(props) => props.theme.colors.font.light1};
	}
`;
