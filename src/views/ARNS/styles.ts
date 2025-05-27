import styled from 'styled-components';

export const Wrapper = styled.div`
	max-width: 1200px;
	margin: 0 auto;
	padding: 20px;
`;

export const Header = styled.div`
	margin-bottom: 30px;

	h1 {
		font-size: 32px;
		font-weight: 600;
	}
`;

export const TabsWrapper = styled.div`
	width: 100%;
`;

export const TabWrapper = styled.div<{
	active?: boolean;
}>`
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 0.5rem 1.25rem;
	border-radius: 8px;
	background: ${({ active }) => (active ? 'var(--background-tertiary)' : 'transparent')};
	color: ${({ active }) => (active ? 'var(--text-primary)' : 'var(--text-secondary)')};
	font-weight: 500;
	font-size: 1rem;
	cursor: pointer;
	border: 1px solid var(--border-primary);
	margin-right: 0.5rem;
	transition: background 0.2s, color 0.2s;
	min-width: 100px;
	min-height: 36px;
	img {
		margin-right: 0.5rem;
		height: 18px;
		width: 18px;
	}
`;

export const TabContent = styled.div`
	margin-top: 20px;
`;

export const ListWrapper = styled.div`
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
	gap: 20px;
	margin-top: 20px;
`;

export const TokenCard = styled.div`
	padding: 20px;
	border-radius: 10px;
	background: var(--background-secondary);
	transition: all 0.2s ease-in-out;

	&:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}

	h3 {
		font-size: 18px;
		font-weight: 600;
		margin-bottom: 10px;
		color: var(--text-primary);
	}

	p {
		color: var(--text-secondary);
		margin-bottom: 15px;
	}
`;

export const ActionsWrapper = styled.div`
	display: flex;
	gap: 10px;
	margin-top: 15px;
`;

export const LoadingWrapper = styled.div`
	display: flex;
	justify-content: center;
	align-items: center;
	min-height: 200px;
`;

export const EmptyWrapper = styled.div`
	display: flex;
	justify-content: center;
	align-items: center;
	min-height: 200px;
	color: var(--text-secondary);
	font-size: 16px;
`;
