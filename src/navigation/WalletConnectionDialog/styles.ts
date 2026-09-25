import styled from 'styled-components';

import { DialogHeadingRow } from 'components/molecules/DialogHeading';
import { Dialog } from 'components/organisms/Dialog';

/*
 * The shared dialog chrome narrows its padding below 480px from a later block in the stylesheet, which used to beat
 * this dialog's own single-class padding. A component stylesheet is applied after the global one, so that narrow
 * padding is restated here to keep the dialog rendering as before.
 */
export const ConnectDialog = styled(Dialog)`
	width: min(580px, 100%);
	padding: clamp(24px, 4vw, 38px);

	@media (max-width: 480px) {
		padding: 20px 16px;
	}
`;

export const Heading = styled(DialogHeadingRow)`
	margin-bottom: 22px;

	.eyebrow {
		margin: 0 0 4px;
	}
`;

export const OptionList = styled.div`
	display: grid;
`;

export const Option = styled.div`
	min-width: 0;
	padding: 14px 0;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 20px;

	& + & {
		border-top: 1px solid var(--line);
	}

	> button {
		flex: 0 0 auto;
		min-width: 96px;
	}
`;

export const OptionCopy = styled.div`
	min-width: 0;
	display: flex;
	align-items: center;
	gap: 13px;

	> .ui-icon {
		width: 20px;
		height: 20px;
		flex: 0 0 auto;
		color: var(--muted);
	}

	> div {
		min-width: 0;
		display: grid;
		gap: 2px;
	}

	strong {
		font-size: var(--type-body);
		font-weight: 600;
	}

	span {
		color: var(--muted);
		font-size: var(--type-small);
		line-height: 1.35;
	}
`;

export const KeyfileWarning = styled.p`
	margin: 18px 0 0;
	padding: 12px 13px;
	border: 1px solid var(--line);
	border-radius: 7px;
	background: var(--panel);
	color: var(--muted);
	font-size: var(--type-small);
	line-height: 1.45;

	strong {
		color: var(--ink);
	}
`;

export const ConnectError = styled.p`
	margin: 18px 0 0;
	padding: 12px 13px;
	border: 1px solid var(--negative-border);
	border-radius: 7px;
	background: var(--negative-surface);
	color: var(--negative);
	font-size: var(--type-small);
	line-height: 1.45;
`;

export const GeneratedPanel = styled.div`
	display: grid;
	gap: 16px;

	strong {
		font-size: var(--type-body);
		font-weight: 600;
	}

	span {
		color: var(--muted);
		font-size: var(--type-small);
		line-height: 1.35;
	}

	> div:first-child {
		display: flex;
		align-items: center;
		gap: 13px;
	}

	> div:first-child > div {
		display: grid;
		gap: 2px;
	}
`;

export const GeneratedAddress = styled.div`
	min-width: 0;
	padding: 13px;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 14px;
	border: 1px solid var(--line);
	border-radius: 7px;
	background: var(--panel);

	> div {
		min-width: 0;
		display: grid;
		gap: 4px;
	}

	code {
		overflow: hidden;
		font-size: var(--type-small);
		text-overflow: ellipsis;
	}
`;
