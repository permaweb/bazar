import styled from 'styled-components';

import { STYLING } from 'helpers/config';

export const Wrapper = styled.div`
	width: 100%;
`;

export const CardWrapper = styled.div<{ backgroundImage: string }>`
	height: 500px;
	width: 100%;
	display: flex;
	justify-content: center;
	align-items: center;
	position: relative;
	background-image: ${(props) => `url(${props.backgroundImage})`};
	background-size: cover;
	background-repeat: no-repeat;
	background-position: center;
	border-radius: ${STYLING.dimensions.radius.primary};
	overflow: hidden;

	&:before {
		content: '';
		display: block;
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: ${(props) => props.theme.colors.overlay.alt1};
		border-radius: inherit;
	}

	> * {
		position: relative;
		z-index: 1;
	}
`;

export const InfoWrapper = styled.div`
	max-width: 100%;
	display: flex;
	flex-direction: column;
	justify-content: center;
	align-items: center;
	@media (max-width: ${STYLING.cutoffs.desktop}) {
		width: 100%;
	}
`;

export const InfoHeader = styled.div`
	margin: 0 0 10px 0;
	h2 {
		color: ${(props) => props.theme.colors.font.light1};
	}
`;

export const InfoCreator = styled.div`
	margin: 0 0 15px 0;
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
