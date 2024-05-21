import styled from 'styled-components';

export const WalletListContainer = styled.div`
	height: 100%;
	width: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 20px;
	flex-wrap: wrap;
	padding: 20px 0 40px 0;
`;

export const WalletListItem = styled.button`
	width: 200px;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	text-align: center;
	padding: 15px;
	img {
		width: 30px;
		border-radius: 50%;
		margin: 0 0 10px 0;
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
`;
