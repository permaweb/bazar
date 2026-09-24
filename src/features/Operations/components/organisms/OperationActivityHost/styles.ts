import styled from 'styled-components';

/** The toast that reports a freshly minted asset going live, pinned to the bottom-right of the viewport. */
export const LiveNotice = styled.div`
	position: fixed;
	right: 18px;
	bottom: 18px;
	z-index: 80;
	max-width: min(520px, calc(100vw - 36px));
	padding: 13px;
	display: flex;
	align-items: center;
	gap: 10px;
	border: 1px solid var(--positive-border);
	border-radius: 8px;
	background: var(--panel);
	box-shadow: 0 18px 48px var(--shadow-medium);

	> div {
		min-width: 0;
		display: grid;
		gap: 2px;
		margin-right: auto;
	}

	span {
		color: var(--muted);
		font-size: var(--type-small);
	}
`;
