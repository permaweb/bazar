import styled from 'styled-components';

export const BatchQuote = styled.div`
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	border: 1px solid var(--line);
	border-radius: 9px;
	overflow: hidden;

	> div {
		min-width: 0;
		padding: 14px;
		display: grid;
		gap: 5px;
	}

	> div + div {
		border-left: 1px solid var(--line);
	}

	> div:nth-child(4) {
		border-left: 0;
	}

	> div:nth-child(n + 4) {
		border-top: 1px solid var(--line);
	}

	span {
		color: var(--muted);
		font-size: var(--type-small);
	}

	strong {
		overflow: hidden;
		font-size: var(--type-body);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	@media (max-width: 760px) {
		grid-template-columns: repeat(2, minmax(0, 1fr));

		> div:nth-child(3) {
			border-left: 0;
			border-top: 1px solid var(--line);
		}

		> div:nth-child(4) {
			border-left: 1px solid var(--line);
			border-top: 1px solid var(--line);
		}

		> div:nth-child(5) {
			border-left: 0;
		}
	}

	@media (max-width: 480px) {
		grid-template-columns: 1fr;

		> div,
		> div:nth-child(n) {
			grid-template-columns: minmax(0, 1fr);
			align-items: start;
			gap: 4px;
			border-left: 0;
			border-top: 1px solid var(--line);
		}

		> div:first-child {
			border-top: 0;
		}

		strong {
			min-width: 0;
			overflow: visible;
			overflow-wrap: anywhere;
			text-align: left;
			text-overflow: clip;
			white-space: normal;
		}
	}
`;
