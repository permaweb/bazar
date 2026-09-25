import styled from 'styled-components';

import { WalletAddress } from 'components/organisms/WalletAddress';

/**
 * Presentation the atomic operation surfaces share: the fact table the form, the quote and the recovery approval
 * all render, and the "preparing" placeholder the progress steps and the upload panel show while work starts.
 *
 * `.operation-side-panel .operation-summary` still lives in the global stylesheet: it is one grouped rule with the
 * fungible dialog's own children, and it outranks this component's class, so the side panels look unchanged.
 */

export const Summary = styled.div`
	padding: 15px 16px;
	display: grid;
	grid-template-columns: minmax(0, 1fr) auto;
	align-items: baseline;
	gap: 5px 20px;
	border: 1px solid var(--line);
	border-radius: 8px;
	background: var(--panel);

	span,
	small {
		color: var(--muted);
		font-size: var(--type-body);
		line-height: 1.5;
	}

	strong {
		font-size: var(--type-body);
	}

	.wallet-identity {
		max-width: 32ch;
		justify-self: end;
		text-align: right;
	}

	small {
		grid-column: 1 / -1;
	}

	@media (max-width: 480px) {
		grid-template-columns: minmax(0, 1fr);
		align-items: start;
		gap: 2px;

		strong,
		.operation-summary-link,
		.wallet-identity {
			max-width: 100%;
			justify-self: start;
			overflow-wrap: anywhere;
			text-align: left;
		}

		strong + span,
		.operation-summary-link + span {
			margin-top: 8px;
		}

		small {
			margin-top: 6px;
			grid-column: auto;
		}
	}
`;

/** The seller link is a `WalletAddress`; its own `.wallet-address` rules sit earlier in the sheet, as before. */
export const SummaryLink = styled(WalletAddress)`
	justify-self: end;
	color: var(--ink);
	font-size: var(--type-body);
	font-weight: 400;
	text-decoration-color: var(--line-dark);
	text-underline-offset: 3px;

	&:hover {
		text-decoration-color: currentColor;
	}
`;

export const Preparing = styled.div`
	min-height: 220px;
	display: grid;
	place-content: center;
	justify-items: center;
	text-align: center;

	.loading {
		padding: 0 0 12px;
		color: var(--ink);
		font-weight: 400;
	}

	p {
		color: var(--muted);
		font-size: var(--type-body);
		line-height: 1.5;
		max-width: 520px;
		margin: 0;
	}
`;
