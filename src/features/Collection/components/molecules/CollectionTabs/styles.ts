import styled from 'styled-components';

// Links when the tab changes the route, buttons when it only switches the panel in place; both look the same.
export const Tabs = styled.nav`
	width: 100%;
	margin: 0 0 28px;
	display: flex;
	gap: 8px;
	border-bottom: 1px solid var(--line);

	a {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 10px 13px 11px;
		border: 1px solid var(--transparent);
		border-bottom: 0;
		border-radius: 5px 5px 0 0;
		color: var(--muted);
		font: 400 var(--type-body) 'DM Sans', sans-serif;
	}

	a::after {
		display: none;
	}

	a:hover {
		color: var(--ink);
		background: var(--panel);
	}

	a.active {
		color: var(--ink);
		border-color: var(--transparent);
		background: var(--paper);
		box-shadow: inset 0 -2px 0 var(--ink);
	}

	@media (max-width: 480px) {
		margin-bottom: 20px;

		a {
			flex: 1;
			justify-content: center;
			min-height: 44px;
		}
	}

	button {
		padding: 10px 13px 11px;
		border: 1px solid var(--transparent);
		border-bottom: 0;
		border-radius: 5px 5px 0 0;
		color: var(--muted);
		background: var(--transparent);
		cursor: pointer;
		font: 400 var(--type-body) 'DM Sans', sans-serif;
	}

	button:hover {
		color: var(--ink);
		background: var(--panel);
	}

	button.active {
		color: var(--ink);
		box-shadow: inset 0 -2px 0 var(--ink);
	}
`;
