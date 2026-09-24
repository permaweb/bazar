import styled from 'styled-components';

export const Summary = styled.div`
	padding: 20px;
	display: flex;
	align-items: center;
	gap: 14px;
	border: 1px solid var(--warning-border);
	border-radius: 9px;
	background: var(--warning-surface);

	> svg {
		flex: 0 0 auto;
		color: var(--warning-text);
	}

	> div {
		min-width: 0;
		display: grid;
		gap: 4px;
	}

	strong,
	span {
		min-width: 0;
		overflow-wrap: anywhere;
	}

	span {
		color: var(--muted-subtle);
		font-size: var(--type-body);
	}
`;
