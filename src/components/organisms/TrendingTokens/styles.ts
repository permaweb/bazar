import styled from 'styled-components';

import { STYLING } from 'helpers/config';

export const Wrapper = styled.div`
	width: 100%;
`;

export const Header = styled.div`
	display: flex;
	justify-content: space-between;
	align-items: center;
	flex-wrap: wrap;
	gap: 20px;
	margin: 0 0 20px 0;
`;

export const TokensWrapper = styled.div`
	display: grid;
	grid-template-columns: repeat(4, 1fr);
	gap: 30px;
	@media (max-width: ${STYLING.cutoffs.desktop}) {
		grid-template-columns: repeat(2, 1fr);
	}
	@media (max-width: ${STYLING.cutoffs.tabletSecondary}) {
		grid-template-columns: 1fr;
	}
`;

export const TokenWrapper = styled.button`
	height: 300px;
	width: 100%;
	a {
		min-height: 100%;
		min-width: 100%;
		height: 100%;
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		transition: all 100ms;
		padding: 20px;
		border: 1px solid transparent;
		border-radius: ${STYLING.dimensions.radius.primary};
		&:hover {
			background: ${(props) => props.theme.colors.container.primary.active};
		}
	}
`;

export const TokenImage = styled.div<{}>`
	height: 150px;
	width: 150px;
	border: 1px solid ${(props) => props.theme.colors.border.primary};
	border-radius: 50%;
	overflow: hidden;
	display: flex;
	justify-content: center;
	align-items: center;
	position: relative;
	margin: 0 0 40px 0;
	img {
		height: 100%;
		width: 100%;
		object-fit: cover;
	}
`;

export const TokenName = styled.div`
	width: 100%;
	margin: 0 0 10px 0;
	p {
		color: ${(props) => props.theme.colors.font.primary};
		font-size: ${(props) => props.theme.typography.size.xLg};
		font-family: ${(props) => props.theme.typography.family.alt1};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		text-align: center;
		margin: auto;
		max-width: 150px;
		white-space: nowrap;
		text-overflow: ellipsis;
		overflow-x: hidden;
	}
`;

export const SDMessageInfo = styled.div`
	width: 100%;
	span {
		color: ${(props) => props.theme.colors.font.primary};
		font-size: ${(props) => props.theme.typography.size.base};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		font-family: ${(props) => props.theme.typography.family.primary};
		display: block;
	}
`;
