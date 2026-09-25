import styled from 'styled-components';

export const Indicator = styled.div`
	display: flex;
	align-items: center;
	gap: var(--space-3);
	padding: var(--space-5) 0;
	color: var(--muted-subtle);
	font-size: var(--type-body);

	span {
		width: 17px;
		height: 17px;
		border: 2px solid var(--line-dark);
		border-top-color: var(--ink);
		border-radius: 50%;
		animation: spin 0.5s linear infinite;
	}
`;
