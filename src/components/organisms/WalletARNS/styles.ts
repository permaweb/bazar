import styled from 'styled-components';

export const Wrapper = styled.div`
	padding: 1rem;
	background: ${({ theme }) => theme.colors.background};
	border-radius: 8px;
	box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

export const Header = styled.div`
	margin-bottom: 1rem;

	h2 {
		font-size: 1.5rem;
		font-weight: 600;
		color: ${({ theme }) => theme.colors.text};
	}
`;

export const Content = styled.div`
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
	gap: 1rem;
`;

export const ARNSItem = styled.div`
	background: ${({ theme }) => theme.colors.card};
	border-radius: 8px;
	padding: 1rem;
	transition: transform 0.2s ease;

	&:hover {
		transform: translateY(-2px);
	}
`;

export const Message = styled.p`
	text-align: center;
	color: ${({ theme }) => theme.colors.textSecondary};
	font-size: 1rem;
	padding: 2rem 0;
`;

export const ErrorMessage = styled(Message)`
	color: ${({ theme }) => theme.colors.error};
`;
