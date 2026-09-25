import styled from 'styled-components';

export const Route = styled.details`
	border: 1px solid var(--line);
	border-radius: 10px;
	background: var(--paper);
	overflow: hidden;

	summary {
		padding: 12px 15px;
		display: flex;
		justify-content: space-between;
		gap: 18px;
		cursor: pointer;
		color: var(--ink);
		font-size: 0.72rem;
		font-weight: 650;
	}

	summary strong {
		color: var(--muted);
		font-size: 0.68rem;
	}

	ul {
		max-height: min(300px, 40dvh);
		margin: 0;
		padding: 0;
		overflow-y: auto;
		list-style: none;
	}

	ul:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: -2px;
	}

	li {
		padding: 11px 15px;
		display: grid;
		grid-template-columns: 22px minmax(0, 1fr) auto auto;
		align-items: center;
		gap: 12px;
		border-top: 1px solid var(--line);
		color: var(--muted);
		font-size: var(--type-body);
	}

	.wallet-address {
		justify-self: end;
		font-size: 0.68rem;
	}

	@media (max-width: 760px) {
		li {
			grid-template-columns: 22px minmax(0, 1fr) auto;
		}

		.wallet-identity {
			grid-column: 2 / -1;
		}
	}

	@media (max-width: 480px) {
		li {
			grid-template-columns: 22px minmax(0, 1fr);
		}

		.wallet-identity {
			grid-column: 2;
		}
	}
`;

export const Index = styled.span`
	width: 22px;
	height: 22px;
	display: grid;
	place-items: center;
	border-radius: 50%;
	background: var(--button-accent-hover);
	color: var(--ink);
	font-size: 0.62rem;
	font-weight: 700;
`;

export const Fill = styled.span`
	min-width: 0;
	display: grid;
	gap: 2px;

	strong {
		color: var(--ink);
		font-size: 0.76rem;
	}

	small {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
`;

export const Total = styled.span`
	color: var(--ink);
	font-weight: 700;

	@media (max-width: 480px) {
		grid-column: 2;
		grid-row: 2;
	}
`;
