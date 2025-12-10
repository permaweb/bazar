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
	margin: 0 0 40px 0;
	@media (max-width: ${STYLING.cutoffs.initial}) {
		height: auto;
	}
`;

export const StampWidgetWrapper = styled.div`
	position: absolute;
	top: 20px;
	right: 20px;
	z-index: 1;
`;

export const OverlayWrapper = styled.div`
	height: 100%;
	width: 100%;
	position: absolute;
	top: 0;
	left: 0;
	background: ${(props) => props.theme.colors.overlay.alt1};
	border-radius: calc(${STYLING.dimensions.radius.primary} - 1px);
`;

export const InfoWrapper = styled.div`
	width: 100%;
	padding: 20px;
	position: relative;
	z-index: 1;
	p,
	span {
		text-shadow: 0 0 5px ${(props) => props.theme.colors.font.dark1};
	}
`;

export const Thumbnail = styled.div`
	height: 85px;
	width: 85px;
	/* background: ${(props) => props.theme.colors.container.primary.background}; */
	/* box-shadow: 0 1px 2px 0.5px ${(props) => props.theme.colors.font.dark1}; */
	border: none;
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
	}
	a {
		&:hover {
			span {
				color: ${(props) => props.theme.colors.font.light1} !important;
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
	display: flex;
	flex-direction: column;
	justify-content: flex-end;
	position: relative;

	button {
		color: ${(props) => props.theme.colors.font.light1};
		font-size: ${(props) => props.theme.typography.size.small};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		&:hover {
			color: ${(props) => props.theme.colors.font.light2};
		}
	}

	@media (max-width: ${STYLING.cutoffs.initial}) {
		width: 100%;
	}
`;

export const DescriptionText = styled.p`
	font-size: ${(props) => props.theme.typography.size.small};
	font-family: ${(props) => props.theme.typography.family.primary};
	font-weight: ${(props) => props.theme.typography.weight.bold};
	color: ${(props) => props.theme.colors.font.light1};
	line-height: 1.65;
	margin: 0;
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 10px;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	text-align: right;
`;

export const AssetsWrapper = styled.div`
	h4 {
		font-size: ${(props) => props.theme.typography.size.xLg};
	}
`;

export const EditButtonWrapper = styled.div`
	position: absolute;
	top: 20px;
	right: 20px;
	z-index: 2;
`;

export const CollectionManageWrapper = styled.div`
	padding: 20px;
`;
