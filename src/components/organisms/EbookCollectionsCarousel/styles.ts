import styled from 'styled-components';

import { STYLING } from 'helpers/config';

export const Wrapper = styled.div`
	width: 100%;
	margin: 0 auto;
`;

export const CollectionsWrapper = styled.div`
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
	}
`;

export const CollectionWrapper = styled.div<{ backgroundImage: string | null; disabled: boolean }>`
	height: 350px;
	margin: 0 10px;
	overflow: hidden;
	position: relative;
	background-image: ${(props) => (props.backgroundImage ? `url(${props.backgroundImage})` : 'none')};
	background-size: cover;
	background-repeat: no-repeat;
	background-position: center;
	background-color: ${(props) => props.theme.colors.container.alt1.background};
	flex: 1;

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
	background: linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.4) 50%, rgba(0, 0, 0, 0.8) 100%);
	border-radius: ${STYLING.dimensions.radius.alt2};
`;

export const InfoTile = styled.div`
	display: flex;
	flex-direction: column;
	gap: 5px;
`;

export const InfoDetail = styled.div`
	span {
		font-size: 16px;
		font-weight: 500;
		color: ${(props) => props.theme.colors.font.primary.alt1};
		line-height: 1.2;
	}
`;

export const InfoDetailAlt = styled.div`
	span {
		font-size: 14px;
		font-weight: 400;
		color: ${(props) => props.theme.colors.font.primary.alt2};
		line-height: 1.2;
	}
`;
