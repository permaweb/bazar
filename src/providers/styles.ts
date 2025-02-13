import styled from 'styled-components';

import { STYLING } from 'helpers/config';

export const WalletListContainer = styled.div`
	height: 100%;
	width: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 20px;
	flex-wrap: wrap;
	padding: 10px 20px 5px 20px;
`;

export const WalletListItem = styled.button`
	min-height: 105px;
	display: flex;
	flex: 1;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	text-align: center;
	padding: 15px;
	border: 1px solid ${(props) => props.theme.colors.border.primary} !important;
	img {
		width: 30px;
		border-radius: 50%;
		margin: 0 0 15px 0;
	}
	span {
		color: ${(props) => props.theme.colors.font.primary};
		font-size: ${(props) => props.theme.typography.size.base};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		font-family: ${(props) => props.theme.typography.family.alt1};
	}
	&:hover {
		background: ${(props) => props.theme.colors.container.primary.active};
	}

	@media (max-width: ${STYLING.cutoffs.secondary}) {
		flex: none;
		width: 100%;
	}
`;

export const WalletItemImageWrapper = styled.div`
	min-height: 40px;
	display: flex;
	justify-content: center;
	align-items: center;
	img {
		width: 30px;
	}
`;

export const WalletLink = styled.div`
	margin: 10px 0 20px 0;
	padding: 0 20px;
	text-align: center;
	a,
	span {
		font-size: ${(props) => props.theme.typography.size.small};
		font-weight: ${(props) => props.theme.typography.weight.medium};
	}
	a {
		text-decoration: underline;
	}
	span {
		color: ${(props) => props.theme.colors.font.alt1};
	}
`;

export const ErrorBoundaryContainer = styled.div`
	width: fit-content;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 20px;
	margin: 20px auto;

	h4 {
		font-size: ${(props) => props.theme.typography.size.lg};
		font-family: ${(props) => props.theme.typography.family.alt1};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		color: ${(props) => props.theme.colors.font.primary.primary};
		text-align: center;
		line-height: 1.5;
		margin: 0;
	}
`;
