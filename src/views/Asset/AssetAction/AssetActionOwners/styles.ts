import styled from 'styled-components';

import { STYLING } from 'helpers/config';

export const Wrapper = styled.div`
	padding: 20px;
	margin: 22.5px 0 0 0;
	position: relative;
	overflow: hidden;
	display: flex;
	flex-direction: column;
	gap: 30px;
`;

export const InfoLine = styled.div`
	span {
		color: ${(props) => props.theme.colors.font.primary};
		font-size: ${(props) => props.theme.typography.size.base};
		font-family: ${(props) => props.theme.typography.family.primary};
		font-weight: ${(props) => props.theme.typography.weight.bold};
	}
`;

export const ChartWrapper = styled.div`
	width: 100%;
	display: flex;
	flex-wrap: wrap;
	@media (max-width: ${STYLING.cutoffs.initial}) {
		flex-direction: column;
	}
`;

export const ChartKeyWrapper = styled.div`
	min-width: 230px;
	display: flex;
	flex-direction: column;
	gap: 10px;
	@media (max-width: ${STYLING.cutoffs.initial}) {
		width: 100%;
		flex-direction: row;
		flex-wrap: wrap;
		gap: 10px 25px;
	}
	@media (max-width: ${STYLING.cutoffs.secondary}) {
		width: 100%;
		flex-direction: column;
		flex-wrap: wrap;
		gap: 10px;
	}
`;

export const ChartKeyLine = styled.div<{ first: boolean }>`
	display: flex;
	align-items: center;
`;

export const Percentage = styled.p`
	font-size: ${(props) => props.theme.typography.size.xSmall};
	line-height: calc(${(props) => props.theme.typography.size.xSmall} + 5px);
	font-family: ${(props) => props.theme.typography.family.primary};
	font-weight: ${(props) => props.theme.typography.weight.bold};
	color: ${(props) => props.theme.colors.font.alt1};
	padding: 0 !important;
	border: none !important;
	margin: 0 0 0 7.5px;
`;

export const ChartKey = styled.div<{ background: string }>`
	height: 20px;
	width: 20px;
	background: ${(props) => props.background};
	border: 1px solid ${(props) => props.theme.colors.border.primary};
	border-radius: 2.5px;
	margin: 0 12.5px 0 0;
`;

export const ChartKeyText = styled.p`
	font-size: ${(props) => props.theme.typography.size.base};
	font-family: ${(props) => props.theme.typography.family.primary};
	font-weight: ${(props) => props.theme.typography.weight.bold};
	color: ${(props) => props.theme.colors.font.primary};
`;

export const Chart = styled.div`
	height: auto;
	width: calc(100% - 285px);
	display: flex;
	justify-content: center;
	align-items: center;
	padding: 20px;
	@media (max-width: ${STYLING.cutoffs.initial}) {
		width: 100%;
		margin: 40px 0 20px 0;
		padding: 0;
	}
`;
