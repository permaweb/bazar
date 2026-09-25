import styled from 'styled-components';

export const Verification = styled.p`
	margin: var(--space-3) 0 0;
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 3px;
	color: var(--muted);
	font-size: var(--type-small);
	line-height: 1.4;

	strong {
		min-width: 0;
		max-width: 32ch;
		overflow: hidden;
		color: var(--ink);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
`;
