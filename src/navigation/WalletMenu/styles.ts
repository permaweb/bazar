import { Check } from 'lucide-react';
import styled from 'styled-components';

import { Button } from 'components/atoms/Button';

/**
 * The stylesheet set `.wallet` twice unconditionally (`min-height`/`padding` first, then a later block with
 * `min-width`/`min-height`/`padding`). The later block won everywhere, so only its values survive here, and the
 * `max-width: 760px` / first `max-width: 600px` blocks that it already overrode are gone.
 */
export const WalletButton = styled(Button)`
	min-width: 36px;
	min-height: 36px;
	padding: 0 11px;
	border-radius: 7px;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 7px;

	&:hover:not(:disabled) {
		color: var(--ink);
		background: var(--button-accent-hover);
		border-color: var(--line-dark);
	}

	@media (max-width: 600px) {
		width: 44px;
		min-width: 44px;
		height: 44px;
		min-height: 44px;
		padding: 0;
		border-radius: 7px;

		> span {
			display: none;
		}
	}
`;

export const Menu = styled.div`
	position: relative;
	display: inline-flex;
`;

export const Dropdown = styled.div`
	position: absolute;
	z-index: 85;
	top: calc(100% + 7px);
	right: 0;
	width: 260px;
	padding: 10px;
	border: 1px solid var(--line-dark);
	border-radius: 9px;
	background: var(--paper);
	box-shadow: 0 18px 44px var(--shadow-color);
	white-space: normal;

	button[role^='menuitem'] {
		width: 100%;
		min-height: 38px;
		padding: 0 8px;
		display: flex;
		align-items: center;
		justify-content: flex-start;
		gap: 10px;
		border-color: var(--transparent);
		background: var(--transparent);
		text-align: left;
	}

	button[role^='menuitem']:hover:not(:disabled) {
		border-color: var(--transparent);
		background: var(--panel);
	}

	button[role='menuitemradio'].is-active {
		background: var(--panel);
	}

	> p {
		margin: 8px 8px 2px;
		color: var(--negative);
		font-size: var(--type-small);
		line-height: 1.35;
	}
`;

export const DropdownHeader = styled.div`
	padding: 7px 8px 12px;
	display: flex;
	align-items: center;
	gap: 11px;
	border-bottom: 1px solid var(--line);

	/*
	 * Doubled so this keeps beating the header's own .site-nav .ui-icon colour. Both rules used to weigh two
	 * classes and this one won by coming later in the stylesheet; once each moves to its own component, the
	 * header's rules are emitted last, so the tie has to be broken here instead.
	 */
	&& > .ui-icon {
		width: 18px;
		height: 18px;
		color: var(--muted);
	}

	> div {
		min-width: 0;
		display: grid;
		gap: 1px;
	}

	span {
		color: var(--muted);
		font-size: var(--type-small);
	}

	strong {
		overflow: hidden;
		font-size: var(--type-body);
		font-weight: 550;
		text-overflow: ellipsis;
	}
`;

export const Balances = styled.div`
	padding: 12px 8px;
	display: grid;
	gap: 8px;
	border-bottom: 1px solid var(--line);
`;

export const Balance = styled.div`
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 16px;

	> span {
		color: var(--muted);
		font-size: var(--type-small);
	}

	> strong {
		min-width: 0;
		display: inline-flex;
		align-items: center;
		justify-content: flex-end;
		gap: 8px;
		overflow: hidden;
		font-size: var(--type-body);
		font-weight: 550;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/*
	 * The only image here is the AR currency label's, and its own rule sits later in the stylesheet with the same
	 * weight, so its 1em box always won. Only the margin this rule really contributed moves across.
	 */
	img {
		flex: 0 0 auto;
		display: block;
		margin: 1px 0 0 0;
	}

	/* The leading * keeps the nested selector a descendant one: stylis attaches a bare :root to this class. */
	*:root[data-theme='dimmed'] & img,
	*:root[data-theme='dark'] & img {
		filter: invert(1);
	}
`;

export const Actions = styled.div`
	padding-block: 8px;
	display: grid;
`;

export const Appearance = styled.div`
	padding-block: 8px;
	display: grid;
	border-top: 1px solid var(--line);
`;

export const SectionLabel = styled.span`
	padding: 0 8px 5px;
	color: var(--muted);
	font-size: var(--type-small);
`;

export const DropdownFooter = styled.div`
	padding-block: 8px;
	display: grid;
	padding-bottom: 0;
	border-top: 1px solid var(--line);
`;

export const ThemeOptionCheck = styled(Check)`
	width: 14px;
	height: 14px;
	margin-left: auto;
	color: var(--positive);
	stroke-width: 2;
`;
