import styled from 'styled-components';

// `!important` keeps the placeholder legible inside the price slots it replaces, which set their own
// display, colour and margin on the same elements.
export const Pending = styled.span`
	min-width: 0;
	display: inline-flex !important;
	align-items: center;
	gap: 5px;
	color: var(--home-muted) !important;
	white-space: nowrap;

	> svg {
		width: 13px;
		height: 13px;
		flex: 0 0 auto;
		animation: spin 0.8s linear infinite;
	}

	> span {
		min-width: 0;
		margin: 0 !important;
		color: inherit !important;
		font: inherit;
	}
`;
