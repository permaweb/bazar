import styled from 'styled-components';

export const Listings = styled.section`
	border: 1px solid var(--line);
	border-radius: 8px;
	background: var(--panel);

	ul {
		max-height: min(300px, 40dvh);
		margin: 0;
		padding: 0 14px 12px;
		overflow-y: auto;
		list-style: none;
	}

	ul:focus-visible {
		outline: 2px solid var(--focus-ring);
		outline-offset: -2px;
	}

	li {
		padding: 7px 0;
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto auto;
		align-items: center;
		gap: 16px;
		border-top: 1px solid var(--line);
		color: var(--muted);
		font-size: var(--type-body);
	}

	li > span:first-child {
		min-width: 0;
		display: grid;
		gap: 2px;
	}

	li > span:first-child small {
		overflow: hidden;
		color: var(--muted);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	a {
		flex: 0 0 auto;
		color: var(--ink);
		text-underline-offset: 3px;
	}

	button {
		min-height: 34px;
		padding: 6px 10px;
		color: var(--muted);
		background: var(--paper);
		font-size: var(--type-small);
	}

	button:hover {
		color: var(--negative);
		border-color: color-mix(in srgb, var(--negative) 45%, var(--line));
	}
`;

export const Heading = styled.div`
	padding: 11px 14px;
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: 16px;
	color: var(--ink);
	font-size: var(--type-body);
	font-weight: 400;

	> span {
		color: var(--muted);
		font-size: var(--type-small);
	}
`;

export const Empty = styled.p`
	margin: 0;
	padding: 14px;
	border-top: 1px solid var(--line);
	color: var(--muted);
	font-size: var(--type-body);
`;
