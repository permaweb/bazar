import styled from 'styled-components';

import { Button } from '../../atoms/Button';
import { Tooltip } from '../../atoms/Tooltip';

/**
 * The address chip. `.wallet-address` keeps its class as a stable hook: several feature containers
 * (`.asset-owner-line`, `.fungible-orderbook`, the activity lists) restyle it by descendant selector and must
 * keep winning, which they do -- their rules weigh two classes against this one.
 */
export const Address = styled.span`
	max-width: 100%;
	min-height: 28px;
	padding: 4px 6px;
	display: inline-flex;
	align-items: center;
	gap: 6px;
	overflow: hidden;
	border: 0;
	border-radius: 5px;
	background: var(--transparent);
	cursor: default;
	color: inherit;
	font: inherit;
	font-weight: inherit;
	line-height: 1.2;

	> span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	&.is-full {
		min-width: 0;
		align-items: center;
		text-align: left;
	}

	&.is-full > span {
		min-width: 0;
		overflow: visible;
		overflow-wrap: anywhere;
		text-overflow: clip;
		white-space: normal;
	}

	&.is-full > svg {
		align-self: center;
		flex: 0 0 auto;
	}

	&:hover {
		background: var(--surface-hover);
	}

	&.is-failed {
		color: var(--negative);
		text-decoration: none;
	}

	> small {
		flex: 0 0 auto;
		font-size: var(--type-small);
		white-space: nowrap;
	}

	@media (max-width: 480px) {
		min-height: 44px;
		padding-inline: 4px;
	}
`;

export const AddressTooltip = styled(Tooltip)`
	max-width: 100%;
	min-width: 0;
`;

/**
 * The copy control. Its min-height, padding, border-radius and resting colour were already overridden by the
 * Button atom's own rules when these lived in the stylesheet, so only the declarations that actually won are
 * kept; the focus-visible pair still outweighs the ghost variant.
 */
export const Copy = styled(Button)`
	min-width: 22px;
	flex: 0 0 auto;

	&:hover,
	&:focus-visible {
		color: var(--ink);
		background: var(--surface-hover);
	}
`;

// The plain identity label, used when the address is shown without the copy control.
export const Identity = styled.span`
	min-width: 0;
	color: var(--ink);
	font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
	font-size: var(--type-small);
	line-height: 1.45;
	overflow-wrap: anywhere;
	user-select: text;
`;
