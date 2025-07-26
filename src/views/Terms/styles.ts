import styled from 'styled-components';

export const Wrapper = styled.div`
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: flex-start;
	min-height: 100vh;
	padding: 2rem 0;
	background: var(--background-primary);
`;

export const Container = styled.div`
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	justify-content: flex-start;
	width: 100%;
	max-width: 800px;
	padding: 0 2rem;
`;

export const Header = styled.div`
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	justify-content: flex-start;
	width: 100%;
	margin-bottom: 3rem;
	padding-bottom: 2rem;
	border-bottom: 1px solid var(--border-primary);

	h1 {
		font-size: 2.5rem;
		font-weight: 700;
		color: var(--text-primary);
		margin: 0 0 1rem 0;
	}

	p {
		font-size: 1rem;
		color: var(--text-secondary);
		margin: 0;
	}
`;

export const Content = styled.div`
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	justify-content: flex-start;
	width: 100%;
	gap: 2rem;
`;

export const Section = styled.div`
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	justify-content: flex-start;
	width: 100%;

	h2 {
		font-size: 1.5rem;
		font-weight: 600;
		color: var(--text-primary);
		margin: 0 0 1rem 0;
	}

	p {
		font-size: 1rem;
		line-height: 1.6;
		color: var(--text-secondary);
		margin: 0 0 1rem 0;

		&:last-child {
			margin-bottom: 0;
		}
	}

	ul {
		margin: 0 0 1rem 0;
		padding-left: 1.5rem;

		li {
			font-size: 1rem;
			line-height: 1.6;
			color: var(--text-secondary);
			margin-bottom: 0.5rem;

			&:last-child {
				margin-bottom: 0;
			}
		}
	}
`;
