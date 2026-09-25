import styled from 'styled-components';

/** The inline "operation in progress" banner an asset page shows above its commerce controls. */
export const Status = styled.div`
	margin-top: 16px;
	padding: 11px 12px;
	display: grid;
	grid-template-columns: 32px minmax(0, 1fr) auto;
	align-items: center;
	gap: 10px;
	border: 1px solid color-mix(in srgb, var(--notice-text) 24%, var(--line));
	border-radius: 8px;
	background: var(--notice-surface);
	color: var(--notice-text);

	& + & {
		margin-top: 8px;
	}

	&.error {
		border-color: var(--negative-subtle-border);
		background: var(--negative-subtle-surface);
		color: var(--negative);
	}

	> button {
		min-height: 34px;
		padding: 6px 9px;
		border-color: currentColor;
		color: inherit;
		background: var(--transparent);
		white-space: nowrap;
	}

	@media (max-width: 760px) {
		grid-template-columns: 32px minmax(0, 1fr);

		> button {
			grid-column: 2;
			justify-self: start;
		}
	}
`;

export const StatusIcon = styled.span`
	width: 32px;
	height: 32px;
	display: grid;
	place-items: center;
	border: 1px solid currentColor;
	border-radius: 50%;
`;

export const StatusCopy = styled.span`
	min-width: 0;
	display: grid;
	gap: 2px;

	strong,
	small {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	strong {
		color: var(--ink);
		font-size: var(--type-body);
	}

	small {
		color: currentColor;
		font-size: var(--type-small);
	}
`;
