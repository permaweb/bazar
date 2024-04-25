import styled from 'styled-components';

import { STYLING } from 'helpers/config';

const INFO_DIMENSION = '550px';

export const Wrapper = styled.div`
	max-height: 500px;
	width: 100%;
	display: flex;
`;

export const InfoWrapper = styled.div`
	width: ${INFO_DIMENSION};
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
`;

export const InfoCreator = styled.div`
	margin: 0 0 15px 0;
	display: flex;
	align-items: center;
	p {
		font-size: ${(props) => props.theme.typography.size.base};
		font-family: ${(props) => props.theme.typography.family.primary};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		color: ${(props) => props.theme.colors.font.primary};
		margin: 0 10px 0 0;
	}
`;

export const InfoDescription = styled.div`
	p {
		font-size: ${(props) => props.theme.typography.size.base};
		font-family: ${(props) => props.theme.typography.family.primary};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		color: ${(props) => props.theme.colors.font.alt1};
		line-height: 1.65;
	}
`;

export const BannerWrapper = styled.div`
	width: calc(100% - ${INFO_DIMENSION});
	max-width: 100%;
	@media (max-width: ${STYLING.cutoffs.desktop}) {
		width: 100%;
		padding: 0;
	}
	img {
		height: 100%;
		width: 100%;
		object-fit: cover;
		border-radius: ${STYLING.dimensions.radius.primary};
	}
`;
