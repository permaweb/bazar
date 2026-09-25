import styled from 'styled-components';

import { Dialog } from 'components/organisms/Dialog';

export { Preparing } from '../../../styles/operation-panel';

/**
 * The upload side panel. `.dialog`, `.operation-side-panel` and the backdrop chrome are still global: four dialogs
 * across three features share them through the `Dialog` organism's caller-supplied class names.
 */
export const Panel = styled(Dialog)`
	display: flex;
	flex-direction: column;

	> .mint-transaction-receipts {
		margin-top: auto;
		padding-top: var(--space-4);
		border-top: 1px solid var(--line);
	}

	> .wide {
		margin-top: var(--space-4);
	}
`;

export const State = styled.div`
	min-height: 250px;
	padding: clamp(28px, 7vh, 64px) 20px;
	display: grid;
	place-items: center;
	align-content: center;
	gap: 22px;
	text-align: center;

	&.done .upload-activity-result-icon {
		color: var(--positive-text);
		border-color: var(--positive-border);
		background: var(--positive-surface);
	}

	&.error .upload-activity-result-icon {
		color: var(--negative);
		border-color: var(--negative-border);
		background: var(--negative-surface);
	}

	> div {
		max-width: 460px;
		display: grid;
		gap: 7px;
	}

	strong {
		font-size: var(--type-display);
		font-weight: 500;
	}

	p {
		margin: 0;
		color: var(--muted);
		font-size: var(--type-body);
		line-height: 1.55;
	}
`;

export const ResultIcon = styled.span`
	width: 96px;
	height: 96px;
	display: grid;
	place-items: center;
	border: 1px solid var(--line-dark);
	border-radius: 50%;
	background: var(--surface-subtle);

	svg {
		width: 48px;
		height: 48px;
		stroke-width: 1.25;
	}
`;
