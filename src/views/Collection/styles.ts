import styled from 'styled-components';

import { STYLING } from 'helpers/config';

export const Wrapper = styled.div`
	width: 100%;
`;

export const CardWrapper = styled.div<{ backgroundImage: string }>`
	height: 500px;
	width: 100%;
	position: relative;
	display: flex;
	align-items: flex-end;
	background-image: ${(props) => `url(${props.backgroundImage})`};
	background-size: cover;
	background-repeat: no-repeat;
	background-position: center;
	border-radius: ${STYLING.dimensions.radius.primary};
	overflow: hidden;

	> * {
		position: relative;
		z-index: 1;
	}
`;

export const Thumbnail = styled.div`
	height: 85px;
	width: 85px;
	background: ${(props) => props.theme.colors.container.primary.background};
	border-radius: ${STYLING.dimensions.radius.alt2};
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
	background: ${(props) => `linear-gradient(0deg, ${props.theme.colors.overlay.alt2} 50%,transparent)`};
	p,
	span {
		text-shadow: 0 0 5px #000000;
	}
`;

export const InfoHeader = styled.div`
	width: 100%;
	display: flex;
	margin: 20px 0 0 0;
`;

export const InfoDetail = styled.div`
	width: 100%;
	display: flex;
`;

export const InfoHeaderTile = styled.div`
	display: flex;
	justify-content: flex-end;
	flex: 1;
	span {
		font-size: ${(props) => props.theme.typography.size.base};
		font-family: ${(props) => props.theme.typography.family.primary};
		font-weight: ${(props) => props.theme.typography.weight.medium};
		color: ${(props) => props.theme.colors.font.light2};
	}
`;

export const InfoHeaderFlex2 = styled(InfoHeaderTile)`
	justify-content: flex-start;
	flex: 2;
`;

export const InfoDetailTile = styled.div`
	display: flex;
	justify-content: flex-end;
	flex: 1;
	span {
		font-size: ${(props) => props.theme.typography.size.xLg};
		font-family: ${(props) => props.theme.typography.family.alt1};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		color: ${(props) => props.theme.colors.font.light1};
	}
`;

export const InfoDetailFlex2 = styled(InfoDetailTile)`
	justify-content: flex-start;
	flex: 2;
`;

export const InfoCreator = styled.div`
	margin: 15px 0 0 0;
	display: flex;
	align-items: center;
	p,
	a {
		font-size: ${(props) => props.theme.typography.size.base};
		font-family: ${(props) => props.theme.typography.family.primary};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		color: ${(props) => props.theme.colors.font.light1};
		margin: 0 10px 0 0;
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
`;

export const InfoDescription = styled.div`
	p {
		font-size: ${(props) => props.theme.typography.size.base};
		font-family: ${(props) => props.theme.typography.family.primary};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		color: ${(props) => props.theme.colors.font.light2};
		line-height: 1.65;
	}
`;

export const AssetsWrapper = styled.div`
	margin: 60px 0 0 0;
`;
