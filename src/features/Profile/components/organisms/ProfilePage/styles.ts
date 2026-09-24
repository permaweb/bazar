import styled from 'styled-components';

import { Button } from 'components/atoms/Button';
import { Pressable } from 'components/atoms/Pressable';

// The profile route: identity block, optional bio, resolution notices, then whatever the route nests inside.
export const Page = styled.section`
	width: 100%;
	margin: 0 auto;
	padding: 42px 0 72px;

	@media (max-width: 640px) {
		padding-top: 20px;
	}
`;

export const Hero = styled.section`
	background: var(--paper);
`;

export const Identity = styled.div`
	min-width: 0;
	display: flex;
	align-items: center;
	gap: 20px;
	padding: 28px 0;

	/*
	 * The 640px block also sized the avatar, but the profile identity molecule's own width and height are
	 * injected after ProfileRoute.css and already beat it, so those two declarations are dropped rather than
	 * moved: re-homing them here would raise their weight and start shrinking the avatar.
	 */
	.profile-page__avatar {
		box-shadow: none;
	}

	@media (max-width: 640px) {
		align-items: flex-start;
		gap: 14px;
		padding: 20px 0;
	}
`;

export const AvatarButton = styled(Pressable)`
	position: relative;
	padding: 0;
	flex: 0 0 auto;
	overflow: hidden;
	border: 0;
	border-radius: 50%;
	background: transparent;
	cursor: pointer;

	&:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 4px;
	}

	&:is(:hover, :focus-visible) .profile-page__avatar-edit {
		opacity: 1;
	}
`;

// The camera overlay that appears over the avatar while the profile can be edited.
export const AvatarEdit = styled.span`
	position: absolute;
	inset: 0;
	display: grid;
	place-items: center;
	border-radius: 50%;
	background: color-mix(in srgb, var(--fixed-shade) 66%, transparent);
	color: var(--contrast-text);
	opacity: 0;
	transition: opacity 160ms ease;

	.ui-icon {
		width: 20px;
		height: 20px;
	}

	@media (hover: none) {
		opacity: 0.72;
	}
`;

export const Heading = styled.div`
	min-width: 0;
	flex: 1 1 auto;

	h1 {
		margin: 0 0 4px;
		min-width: 0;
		overflow: hidden;
		font-size: var(--type-page-title);
		line-height: 1;
		letter-spacing: -0.025em;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
`;

export const TitleRow = styled.div`
	min-width: 0;
	display: flex;
	align-items: center;
	gap: 6px;
`;

export const EditButton = styled(Button)`
	flex: 0 0 auto;
`;

export const EyebrowText = styled.p`
	margin: 0 0 12px;
	color: var(--muted-subtle);
	font: 400 var(--type-small) / 1.3 'DM Sans', sans-serif;
`;

export const Address = styled.p`
	max-width: 100%;
	margin: 0;
	overflow: hidden;
	color: var(--muted);
	font-size: var(--type-small);
	font-variant-numeric: tabular-nums;
	text-overflow: ellipsis;
	white-space: nowrap;
`;

export const Action = styled.div`
	flex: 0 0 auto;
	padding-bottom: 7px;

	@media (max-width: 640px) {
		position: absolute;
		right: 30px;
		margin-top: 76px;
	}
`;

export const Bio = styled.p`
	max-width: 740px;
	margin: 0 0 28px 112px;
	color: var(--muted);
	font-size: var(--type-body);
	line-height: 1.65;

	@media (max-width: 640px) {
		margin-top: 24px;
		margin-right: 0;
		margin-left: 0;
	}
`;

export const Notice = styled.div`
	margin-top: 18px;
	padding: 14px 16px;
	display: flex;
	align-items: center;
	gap: 9px;
	border: 1px solid var(--line);
	border-radius: 10px;
	color: var(--muted);
	background: var(--surface-subtle);
	font-size: var(--type-small);

	&.profile-page__notice--error {
		justify-content: space-between;
		border-color: var(--danger-border);
		color: var(--danger);
	}

	button {
		padding: 5px 9px;
		border: 1px solid currentColor;
		border-radius: 6px;
		color: inherit;
		background: transparent;
		cursor: pointer;
	}
`;

export const Content = styled.section`
	margin-top: 24px;

	.profile-assets {
		padding-top: 0;
	}

	.profile-assets > .asset-group:first-of-type {
		margin-top: 0;
	}
`;
