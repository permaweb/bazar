import styled from 'styled-components';

import { Button } from '../../atoms/Button';

export const Panel = styled.div`
	margin: var(--space-3) 0 var(--space-5);
	padding: var(--space-4);
	border: 1px solid var(--negative-border);
	border-radius: 10px;
	background: var(--negative-surface);
	display: flex;
	flex-direction: column;
	gap: var(--space-2);
	color: var(--negative);

	> span {
		line-height: 1.45;
	}
`;

export const Actions = styled.div`
	display: flex;
	flex-wrap: wrap;
	gap: var(--space-2);
	margin-top: var(--space-1);
`;

export const Action = styled(Button)`
	width: fit-content;
	border-color: currentColor;
	background: var(--transparent);
	color: inherit;
`;
