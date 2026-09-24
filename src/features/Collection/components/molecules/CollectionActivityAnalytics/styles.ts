import styled from 'styled-components';

// How much of the collection's activity has been indexed, as a two-column figure grid.
export const Summary = styled.div`
	padding: 16px;
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 18px 14px;

	> div {
		min-width: 0;
		display: grid;
		gap: 4px;
	}

	span {
		color: var(--muted-subtle);
		font-size: var(--type-small);
	}

	strong {
		overflow: hidden;
		font-size: var(--type-body);
		font-weight: 400;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
`;
