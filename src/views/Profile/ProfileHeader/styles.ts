import styled from 'styled-components';

import { STYLING } from 'helpers/config';

const CARD_HEIGHT = '500px';

export const Wrapper = styled.div<{ backgroundImage: string }>`
	height: ${CARD_HEIGHT};
	width: 100%;
	position: relative;
	display: flex;
	align-items: flex-end;
	background-image: ${(props) => `url(${props.backgroundImage})`};
	background-size: cover;
	background-repeat: no-repeat;
	background-position: center;
	border-radius: ${STYLING.dimensions.radius.primary};
	margin: 0 0 60px 0;
	@media (max-width: ${STYLING.cutoffs.initial}) {
		height: auto;
	}
`;

export const HeaderInfo = styled.div`
	width: 100%;
	padding: 20px;
	background: ${(props) => `linear-gradient(0deg, ${props.theme.colors.overlay.alt1} 50%,transparent)`};
	h4,
	p,
	span {
		text-shadow: 0 0 5px ${(props) => props.theme.colors.font.dark1};
	}

	button {
		span {
			text-shadow: none;
		}
	}
	display: flex;
	flex-wrap: wrap;
	gap: 25px;
	@media (max-width: ${STYLING.cutoffs.secondary}) {
		flex-direction: column;
	}
`;

export const HeaderActions = styled.div`
	height: fit-content;
	margin: auto 0 0 auto;
	display: flex;
	flex-wrap: wrap;
	gap: 20px;

	button {
		width: fit-content;
	}

	@media (max-width: ${STYLING.cutoffs.secondary}) {
		flex-direction: column;
	}
`;

export const HeaderAvatar = styled.div`
	height: 115px;
	width: 115px;
	background: ${(props) => props.theme.colors.container.alt2.background};
	border: 1px solid ${(props) => props.theme.colors.border.primary};
	border-radius: 50%;
	display: flex;
	justify-content: center;
	align-items: center;
	svg {
		height: 65px;
		width: 65px;
		stroke: ${(props) => props.theme.colors.icon.primary.fill};
	}
	img {
		height: 100%;
		width: 100%;
		object-fit: cover;
		border-radius: 50%;
	}
`;

export const HeaderHA = styled.div`
	h4 {
		color: ${(props) => props.theme.colors.font.light1};
		font-size: clamp(24px, 3.25vw, 32px);
		font-weight: ${(props) => props.theme.typography.weight.xxBold};
		line-height: 1.5;
		overflow-wrap: anywhere;
	}
`;

export const HeaderInfoDetail = styled.div`
	margin: 3.5px 0 0 0;
	span {
		color: ${(props) => props.theme.colors.font.light2};
		font-size: ${(props) => props.theme.typography.size.small};
		font-weight: ${(props) => props.theme.typography.weight.bold};
	}
`;

export const HeaderAddress = styled.button`
	display: flex;
	align-items: center;
	margin: 7.5px 0 0 0;
	p {
		color: ${(props) => props.theme.colors.font.light1};
		font-size: ${(props) => props.theme.typography.size.small};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		margin: 0 0 0 10px;
	}
	span {
		color: ${(props) => props.theme.colors.font.light1};
		font-size: ${(props) => props.theme.typography.size.xSmall};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		display: block;
		margin: 0 0 3.5px 10px;
	}
	svg {
		width: 15px;
		fill: ${(props) => props.theme.colors.font.light1};
		margin: 2.5px 0 0 0;
	}
	&:hover {
		opacity: 0.75;
	}
`;

export const MWrapper = styled.div``;

export const Action = styled.div`
	height: fit-content;
	width: fit-content;
`;
