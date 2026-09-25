import styled from 'styled-components';

import { Button } from 'components/atoms/Button';

export const Description = styled.div`
	max-width: 720px;
	margin-top: 12px;

	> p {
		margin: 0;
		color: var(--muted);
		font-size: var(--type-body);
		line-height: 1.55;
		overflow-wrap: anywhere;
		white-space: pre-wrap;
	}

	> p.is-collapsed {
		display: -webkit-box;
		overflow: hidden;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
	}
`;

// Doubled so the toggle keeps the two-class weight `.ui-button.collection-description-toggle` had against the
// button atom's own rules.
export const Toggle = styled(Button)`
	&& {
		min-height: 0;
		margin-top: 7px;
		padding: 0;
		display: inline-flex;
		align-items: center;
		gap: 5px;
		border: 0;
		border-radius: 0;
		color: var(--ink);
		background: var(--transparent);
		font-size: var(--type-small);
	}

	&&:hover:not(:disabled):not([aria-disabled='true']) {
		background: var(--transparent);
	}

	svg {
		width: 14px;
		height: 14px;
	}

	&[aria-expanded='true'] svg {
		transform: rotate(180deg);
	}
`;
