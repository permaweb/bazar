import styled from 'styled-components';

export const Wrapper = styled.div`
	width: 100%;
	display: flex;
	flex-direction: column;
	gap: 20px;
`;

export const Header = styled.div`
	width: 100%;
	display: flex;
	justify-content: space-between;
	align-items: center;

	h4 {
		font-size: 20px;
		font-weight: 600;
	}

	a {
		color: var(--primary-color);
		text-decoration: none;
		font-size: 14px;

		&:hover {
			text-decoration: underline;
		}
	}
`;

export const DomainsWrapper = styled.div`
	width: 100%;
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
	gap: 20px;
`;

export const DomainCard = styled.div`
	width: 100%;
	padding: 20px;
	background: var(--background-secondary);
	border-radius: 8px;
	display: flex;
	flex-direction: column;
	gap: 10px;
	cursor: pointer;
	transition: all 0.2s ease;

	&:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}
`;

export const DomainName = styled.div`
	font-size: 16px;
	font-weight: 600;
	color: var(--text-primary);
`;

export const DomainPrice = styled.div`
	font-size: 14px;
	color: var(--text-secondary);
`;

export const TokensWrapper = styled.div`
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
	gap: 20px;
`;

export const TokenWrapper = styled.div`
	padding: 15px;
	border-radius: 10px;
	background: ${({ theme }) => theme.colors.background.alt1};
	transition: all 0.2s ease-in-out;

	&:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}

	a {
		text-decoration: none;
		color: inherit;
	}

	h3 {
		font-size: 16px;
		font-weight: 600;
		margin-bottom: 8px;
	}

	p {
		color: ${({ theme }) => theme.colors.text.alt1};
		font-size: 14px;
		margin-bottom: 5px;
	}
`;

export const LoadingWrapper = styled.div`
	display: flex;
	justify-content: center;
	align-items: center;
	min-height: 200px;
`;
