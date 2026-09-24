import styled from 'styled-components';

export const Tabs = styled.div`
	margin: 14px 0 6px;
	display: grid;
	grid-auto-flow: column;
	grid-auto-columns: minmax(145px, 1fr);
	gap: 7px;
	overflow-x: auto;

	button {
		min-width: 0;
		padding: 10px 12px;
		display: grid;
		gap: 3px;
		border: 1px solid var(--line);
		border-radius: 7px;
		background: var(--panel);
		cursor: pointer;
		text-align: left;
	}

	button.active {
		border-color: var(--muted);
		background: var(--paper);
		box-shadow: inset 0 0 0 1px var(--tab-inset);
	}

	span,
	small {
		color: var(--muted);
		font-size: var(--type-small);
	}

	strong {
		overflow: hidden;
		font-size: var(--type-body);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	@media (max-width: 480px) {
		grid-auto-columns: minmax(128px, 72vw);
	}
`;
