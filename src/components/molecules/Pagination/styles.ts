import styled from 'styled-components';

export const Nav = styled.nav`
	min-height: 54px;
	display: grid;
	grid-template-columns: minmax(112px, 1fr) auto minmax(112px, 1fr);
	align-items: center;
	gap: 12px;
	padding: 12px 0 0;

	> button:first-child {
		justify-self: start;
	}

	> button:last-child {
		justify-self: end;
	}

	@media (max-width: 480px) {
		grid-template-columns: 1fr 1fr;
	}
`;

export const Pages = styled.div`
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 6px;

	button {
		width: 30px;
		padding: 0;
	}

	@media (max-width: 480px) {
		grid-column: 1 / -1;
		grid-row: 1;
	}
`;

export const Ellipsis = styled.span`
	width: 22px;
	color: var(--home-muted);
	text-align: center;
`;
