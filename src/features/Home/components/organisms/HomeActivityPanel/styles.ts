import styled from 'styled-components';

import { Button } from 'components/atoms/Button';

export const Filters = styled.div`
	margin: 0 0 13px;
	display: flex;
	flex-wrap: wrap;
	gap: 6px;
`;

export const Filter = styled(Button)`
	gap: 7px;

	&[aria-pressed='true'] {
		color: var(--ink);
		border-color: var(--line-dark);
		background: var(--surface-subtle);
	}
`;

export const ActivityLoading = styled.div`
	.loading {
		padding: 0 0 9px;
		gap: 8px;
		font-size: var(--type-small);
	}

	.loading span {
		width: 14px;
		height: 14px;
	}
`;
