import styled from 'styled-components';

import { STYLING } from 'helpers/config';

const CARD_HEIGHT = '500px';

export const Wrapper = styled.div`
	width: 100%;
`;

export const CardWrapper = styled.div<{ backgroundImage: string }>`
	height: ${CARD_HEIGHT};
	width: 100%;
	position: relative;
	display: flex;
	align-items: flex-end;
	background-image: ${(props) => `url(${props.backgroundImage})`};
	background-size: cover;
	background-repeat: no-repeat;
	background-position: center;
	overflow: hidden;
	border-radius: ${STYLING.dimensions.radius.primary};
	@media (max-width: ${STYLING.cutoffs.initial}) {
		height: auto;
	}
`;

export const Thumbnail = styled.div`
	height: 85px;
	width: 85px;
	background: ${(props) => props.theme.colors.container.primary.background};
	border-radius: ${STYLING.dimensions.radius.primary};
	margin: 0 20px 0 0;
	overflow: hidden;
	position: relative;
	img {
		height: 100%;
		width: 100%;
		object-fit: cover;
	}
`;

export const InfoWrapper = styled.div`
	width: 100%;
	padding: 20px;
	background: ${(props) => `linear-gradient(0deg, ${props.theme.colors.overlay.alt1} 50%,transparent)`};
	p,
	span {
		text-shadow: 0 0 5px ${(props) => props.theme.colors.font.dark1};
	}
`;

export const InfoBody = styled.div`
	width: 100%;
	display: flex;
	flex-wrap: wrap;
	gap: 10px;
	margin: 20px 0 0 0;
	@media (max-width: ${STYLING.cutoffs.initial}) {
		flex-direction: column;
	}
`;

export const InfoMetrics = styled.div`
	flex: 1;
	display: flex;
	flex-wrap: wrap;
	gap: 10px;
`;

export const InfoBodyTile = styled.div`
	flex: 1;
	min-width: 150px;
`;

export const InfoHeader = styled.div`
	display: flex;
	justify-content: flex-end;
	flex: 1;
	span {
		font-size: ${(props) => props.theme.typography.size.base} !important;
		font-family: ${(props) => props.theme.typography.family.primary} !important;
		font-weight: ${(props) => props.theme.typography.weight.medium} !important;
		color: ${(props) => props.theme.colors.font.light2} !important;
	}
	@media (max-width: ${STYLING.cutoffs.initial}) {
		justify-content: flex-start;
	}
`;

export const InfoHeaderFlex2 = styled(InfoHeader)`
	justify-content: flex-start;
	flex: 2;
`;

export const InfoDetail = styled.div`
	display: flex;
	justify-content: flex-end;
	flex: 1;
	span {
		font-size: ${(props) => props.theme.typography.size.xLg} !important;
		font-family: ${(props) => props.theme.typography.family.alt1} !important;
		font-weight: ${(props) => props.theme.typography.weight.bold} !important;
		color: ${(props) => props.theme.colors.font.light1} !important;
	}
	img {
		height: 22.5px;
		width: 22.5px;
		margin: 5px 0 0 2.5px;
	}
	a {
		&:hover {
			span {
				color: ${(props) => props.theme.colors.font.light2} !important;
			}
		}
	}
	@media (max-width: ${STYLING.cutoffs.initial}) {
		justify-content: flex-start;
	}
`;

export const InfoDetailFlex2 = styled(InfoDetail)`
	justify-content: flex-start;
	flex: 2;
`;

export const InfoFooter = styled.div`
	margin: 15px 0 0 0;
	display: flex;
	justify-content: space-between;
	align-items: center;
	flex-wrap: wrap;
	gap: 10px;
`;

export const InfoCreator = styled.div`
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 7.5px;
	p,
	a {
		font-size: ${(props) => props.theme.typography.size.base};
		font-family: ${(props) => props.theme.typography.family.primary};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		color: ${(props) => props.theme.colors.font.light1};
		margin: 0 2.5px 0 0;
	}

	p {
		font-weight: ${(props) => props.theme.typography.weight.medium};
		color: ${(props) => props.theme.colors.font.light2};
	}

	a {
		&:hover {
			color: ${(props) => props.theme.colors.font.light2};
		}
	}

	div {
		box-shadow: none !important;
	}
`;

export const InfoDescription = styled.div`
	width: fit-content;
	max-width: 460px;
	p {
		font-size: ${(props) => props.theme.typography.size.base};
		font-family: ${(props) => props.theme.typography.family.primary};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		color: ${(props) => props.theme.colors.font.light2};
		line-height: 1.65;
		max-width: 100%;
		white-space: nowrap;
		text-overflow: ellipsis;
		overflow: hidden;
	}
`;

export const AssetsWrapper = styled.div`
	margin: 40px 0 0 0;
`;
