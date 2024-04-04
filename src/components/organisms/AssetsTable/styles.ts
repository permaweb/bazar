import styled from 'styled-components';

import { STYLING } from 'helpers/config';

export const Wrapper = styled.div`
	width: 100%;
`;

export const AssetsWrapper = styled.div`
	width: calc(100% + 30px);
	display: flex;
	flex-wrap: wrap;
	margin: -15px;
	@media (max-width: ${STYLING.cutoffs.initial}) {
		width: 100%;
		margin: 0;
	}
`;

export const AssetWrapper = styled.div`
	margin: 15px;
	width: calc(33.3% - 30px);
	position: relative;
	@media (max-width: ${STYLING.cutoffs.initial}) {
		width: 100%;
		margin: 0;
	}
`;

export const AssetDataWrapper = styled.div`
	height: 400px;
	width: 100%;
	position: relative;

	::after {
		content: '';
		position: absolute;
		height: 100%;
		width: 100%;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: ${(props) => props.theme.colors.overlay.alt1};
		opacity: 0;
		transition: all 75ms;
	}
	&:hover::after {
		opacity: 1;
	}
	&:focus::after {
		opacity: 1;
	}
	&:hover {
		cursor: pointer;
	}
`;

export const AssetInfoWrapper = styled.div`
	height: 100px;
	width: 100%;
	text-align: center;
	padding: 20px 0;
`;

export const Title = styled.div`
	p {
		font-size: calc(${(props) => props.theme.typography.size.base} + 1px);
		font-family: ${(props) => props.theme.typography.family.primary};
		font-weight: ${(props) => props.theme.typography.weight.bold};
	}
`;

export const Description = styled.div`
	margin: 5px 0 0 0;
	p {
		font-size: ${(props) => props.theme.typography.size.base};
		font-family: ${(props) => props.theme.typography.family.primary};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		color: ${(props) => props.theme.colors.font.alt1};
		line-height: 1.65;
	}
`;
