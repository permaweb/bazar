import styled from 'styled-components';

export { BuySummary, CommerceActions, CommerceCard } from '../../../styles/commerce';

export const PurchaseSummary = styled.div`
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: var(--space-4);

	.asset-buy-summary {
		margin: 0;
		padding: 0;
		border: 0;
	}
`;

export const Edition = styled.span`
	flex-shrink: 0;
	padding: 5px 8px;
	border-radius: 5px;
	background: var(--surface-subtle);
	color: var(--muted);
	font-size: var(--type-small);
`;

export const ReservationNotice = styled.div`
	padding: 14px;
	display: grid;
	gap: 14px;
	border: 1px solid color-mix(in srgb, var(--accent) 42%, var(--line));
	border-radius: 8px;
	background: color-mix(in srgb, var(--accent) 7%, var(--panel));

	> div {
		display: grid;
		gap: 6px;
	}

	p {
		margin: 0;
		color: var(--muted);
		font-size: var(--type-small);
		line-height: 1.5;
	}

	a {
		width: fit-content;
		font-size: var(--type-small);
	}
`;
