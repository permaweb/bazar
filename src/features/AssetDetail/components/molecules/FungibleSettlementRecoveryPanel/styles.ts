import styled from 'styled-components';

export const Panel = styled.section`
	margin: 8px 0 18px;
	padding: 14px 16px;
	display: grid;
	gap: 6px;
	border: 1px solid var(--negative-border);
	border-radius: 8px;
	background: var(--negative-surface);
	text-align: left;

	> div:not(.settlement-receipt-links) {
		display: flex;
		justify-content: space-between;
		gap: 20px;
		color: var(--muted);
		font-size: var(--type-body);
	}

	strong,
	a {
		color: var(--ink);
	}

	p {
		margin: 6px 0 0;
		color: var(--negative);
		font-size: var(--type-body);
		line-height: 1.5;
	}

	&.settlement-success-detail {
		border-color: color-mix(in srgb, var(--positive) 38%, var(--line));
		background: var(--positive-surface);
	}

	&.settlement-success-detail p {
		color: var(--positive-text);
	}

	@media (max-width: 480px) {
		padding: 12px;

		> div:not(.settlement-receipt-links) {
			display: grid;
			grid-template-columns: minmax(0, 1fr);
			gap: 2px;
		}

		strong,
		a {
			min-width: 0;
			overflow-wrap: anywhere;
			text-align: left;
		}
	}
`;
