import styled from 'styled-components';

import { STYLING } from 'helpers/config';

export const Wrapper = styled.div`
	width: 100%;
	@media (max-width: ${STYLING.cutoffs.desktop}) {
		margin: 20px 0 0 0;
	}
`;

export const DataWrapper = styled.div`
	height: 600px;
	width: 100%;
	display: block;
	@media (max-width: ${STYLING.cutoffs.desktop}) {
		display: none;
	}
`;

export const OwnerLine = styled.div`
	display: flex;
	align-items: center;
	p {
		flex: none;
		margin: 0 10px 0 0;
	}
`;

export const CurrencyWrapper = styled.div`
	display: flex;
	align-items: center;
	gap: 10px;
	flex-wrap: wrap;
`;

export const CurrencyInfo = styled.div`
	display: flex;
	align-items: center;
	gap: 6px;
	color: ${(props) => props.theme.colors.font.primary};
	transition: all 0.2s;

	&:hover {
		opacity: 0.7;
	}
`;

export const CurrencyIcon = styled.img`
	height: 16.5px !important;
	width: 16.5px !important;
`;

export const CurrencyName = styled.span`
	font-size: ${(props) => props.theme.typography.size.xSmall};
	font-weight: ${(props) => props.theme.typography.weight.medium};
	color: ${(props) => props.theme.colors.font.alt1};
`;
