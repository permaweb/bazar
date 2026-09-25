import styled from 'styled-components';

import { Button } from 'components/atoms/Button';
import { Icon } from 'components/atoms/Icon';
import { TokenAvatar } from 'components/atoms/TokenAvatar';

export const Control = styled.div`
	position: relative;
`;

/*
 * `min-height`, `padding` and `border-radius` are gone: the shared button rules sit later in the stylesheet and
 * already overrode all three, so restating them here would resize the trigger.
 */
export const Trigger = styled(Button)`
	min-width: 36px;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 8px;
	border-color: var(--transparent);
	color: var(--muted);
	background: var(--transparent);

	> span {
		min-width: 14px;
		height: 14px;
		padding: 0 3px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		color: var(--contrast-text);
		background: var(--negative);
		font-size: var(--type-small);
		line-height: 1;
		text-align: center;
	}

	&:hover:not(:disabled),
	&[aria-expanded='true'] {
		border-color: var(--line);
		color: var(--ink);
		background: var(--surface-subtle);
	}

	&.working > .ui-icon {
		animation: infinity-pulse 1.15s ease-in-out infinite;
	}
`;

export const Menu = styled.section`
	position: absolute;
	z-index: 75;
	top: 42px;
	right: 0;
	width: min(390px, calc(100vw - 24px));
	overflow: hidden;
	border: 1px solid var(--line-dark);
	border-radius: 10px;
	background: var(--paper);
	box-shadow: 0 18px 48px var(--shadow-medium);
`;

export const Heading = styled.div`
	min-height: 70px;
	padding: 14px 15px;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
	border-bottom: 1px solid var(--line);

	> div {
		min-width: 0;
		display: grid;
		gap: 3px;
	}

	strong {
		font-size: var(--type-body);
	}

	span {
		color: var(--muted);
		font-size: var(--type-small);
	}

	> button {
		min-height: 30px;
		padding: 5px 8px;
		border: 0;
		color: var(--muted);
		background: var(--transparent);
		font-size: var(--type-small);
	}
`;

export const List = styled.div`
	max-height: min(430px, calc(100vh - 160px));
	overflow-y: auto;
`;

export const Item = styled.div`
	position: relative;
	border-bottom: 1px solid var(--line);

	&:last-child {
		border-bottom: 0;
	}

	&.working .operation-activity-open {
		padding-right: 12px;
	}

	&.done .operation-activity-symbol {
		border-color: var(--success-subtle-border);
		color: var(--positive);
		background: var(--success-subtle-surface);
	}

	&.error .operation-activity-symbol {
		border-color: var(--negative-subtle-border);
		color: var(--negative);
		background: var(--negative-subtle-surface);
	}
`;

/*
 * As with the trigger, `min-height`, `padding`, `border`, `border-radius` and `background` were already overridden
 * by the later shared button rules, so only the declarations that actually applied move here.
 */
export const Open = styled(Button)`
	width: 100%;
	display: grid;
	grid-template-columns: 40px minmax(0, 1fr) auto 14px;
	align-items: center;
	gap: 10px;
	text-align: left;

	&:hover:not(:disabled) {
		border-color: var(--transparent);
		background: var(--panel);
	}
`;

export const Chevron = styled(Icon)`
	color: var(--muted-subtle);
`;

export const Symbol = styled.span`
	width: 40px;
	height: 40px;
	overflow: hidden;
	display: grid;
	place-items: center;
	border: 1px solid var(--line);
	border-radius: 7px;
	color: var(--muted-subtle);
	background: var(--panel);

	img {
		width: 100%;
		height: 100%;
		display: block;
		object-fit: cover;
	}
`;

export const Copy = styled.span`
	min-width: 0;
	display: grid;
	gap: 2px;
	color: var(--ink);

	strong {
		overflow: hidden;
		font-size: var(--type-body);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	small {
		overflow: hidden;
		color: var(--muted);
		font-size: var(--type-small);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	> span {
		overflow: hidden;
		color: var(--muted-subtle);
		font-size: var(--type-small);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
`;

export const Confirmations = styled.span`
	color: var(--ink);
	font-size: var(--type-small);
	font-variant-numeric: tabular-nums;
	white-space: nowrap;
`;

export const Progress = styled.span`
	display: inline-flex;
	align-items: center;
	gap: 6px;
`;

/**
 * The token avatar keeps the `operation-activity-symbol` class but not the plain symbol's box: `.token-avatar`
 * already overrode every one of those declarations, so only the two-class override and the image rule move here.
 */
export const SymbolAvatar = styled(TokenAvatar)`
	&.token-avatar {
		--token-avatar-size: 40px;
		border-radius: 50%;
	}

	img {
		width: 100%;
		height: 100%;
		display: block;
		object-fit: cover;
	}
`;

export const InfinityGlyph = styled(Icon)`
	animation: infinity-pulse 1.15s ease-in-out infinite;
`;
