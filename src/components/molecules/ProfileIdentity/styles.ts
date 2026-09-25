import styled, { css } from 'styled-components';

export type ProfileSize = 'large' | 'medium' | 'small';

export const Name = styled.span`
	overflow: hidden;
	font-weight: 500;
	text-overflow: ellipsis;
`;

export const Address = styled.span`
	overflow: hidden;
	color: var(--muted-subtle);
	font-variant-numeric: tabular-nums;
	text-overflow: ellipsis;
`;

export const Label = styled.span`
	min-width: 0;
	display: inline-flex;
	align-items: baseline;
	gap: 5px;
	overflow: hidden;
	white-space: nowrap;
`;

const IDENTITY_FONT_SIZE: Record<ProfileSize, string | null> = {
	small: null,
	medium: 'var(--type-body)',
	large: '1.1rem',
};

export const Identity = styled.a<{ $size: ProfileSize }>`
	max-width: 100%;
	display: inline-flex;
	align-items: center;
	gap: 7px;
	border-radius: 7px;
	color: var(--ink);
	line-height: 1.25;
	text-decoration: none;
	${(props) => IDENTITY_FONT_SIZE[props.$size] && `font-size: ${IDENTITY_FONT_SIZE[props.$size]};`}

	&:hover ${Name}, &:focus-visible ${Name} {
		text-decoration: underline;
		text-underline-offset: 3px;
	}

	&:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 3px;
	}
`;

const AVATAR_SIZE: Record<ProfileSize, { box: number; font: number }> = {
	small: { box: 24, font: 10 },
	medium: { box: 36, font: 14 },
	large: { box: 92, font: 30 },
};

export const Avatar = styled.span<{ $size: ProfileSize; $fallback?: boolean }>`
	position: relative;
	flex: 0 0 auto;
	width: ${(props) => AVATAR_SIZE[props.$size].box}px;
	height: ${(props) => AVATAR_SIZE[props.$size].box}px;
	display: grid;
	place-items: center;
	overflow: hidden;
	border: 1px solid color-mix(in srgb, var(--line-dark) 80%, var(--transparent));
	border-radius: 50%;
	background: var(--surface-subtle);
	color: var(--muted);
	font-size: ${(props) => AVATAR_SIZE[props.$size].font}px;
	font-weight: 500;

	img {
		width: 100%;
		height: 100%;
		display: block;
		object-fit: cover;
	}

	${(props) =>
		props.$fallback &&
		css`
			background: radial-gradient(
					circle at 28% 25%,
					color-mix(in srgb, var(--paper) 80%, var(--transparent)),
					var(--transparent) 34%
				),
				linear-gradient(
					145deg,
					var(--surface-subtle),
					color-mix(in srgb, var(--muted-subtle) 20%, var(--paper))
				);
		`}
`;
