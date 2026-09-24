import styled from 'styled-components';

import { Dialog } from 'components/organisms/Dialog';

/**
 * The mint side panel. It keeps its `.dialog operation-side-panel fungible-dialog fungible-mint-dialog` class list:
 * the panel chrome those classes carry is shared with the fungible operation dialog and still lives in the global
 * stylesheet, so only the rules scoped to `.fungible-mint-dialog` moved here.
 */
export const Panel = styled(Dialog)`
	.operation-working {
		display: grid;
		gap: 18px;
	}

	.operation-working > .scheduler-wait {
		margin: 0;
	}

	.mint-transaction-receipts {
		margin-top: 0;
	}
`;

/**
 * The "preparing" placeholder. The atomic operation surfaces render the same markup; the declarations are stated
 * per feature because the create and operation code are separate lazy chunks that may not import each other.
 */
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
