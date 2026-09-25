import styled from 'styled-components';

export const Tabs = styled.div`
	width: fit-content;
	padding: 3px;
	display: flex;
	gap: 3px;
	border: 1px solid var(--line);
	border-radius: 8px;
	background: var(--surface-subtle);

	button {
		min-height: 34px;
		padding: 0 14px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 7px;
		border: 0;
		border-radius: 6px;
		background: var(--transparent);
		color: var(--muted-subtle);
		cursor: pointer;
		font-size: var(--type-body);
		font-weight: 400;
	}

	button.active {
		background: var(--paper);
		color: var(--ink);
		box-shadow: 0 1px 3px var(--shadow-tiny);
	}

	button:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: 2px;
	}
`;
