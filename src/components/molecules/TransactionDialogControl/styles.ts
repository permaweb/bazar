import styled from 'styled-components';

export const HideIcon = styled.span`
	position: relative;
	width: 20px;
	height: 20px;
	display: block;

	> .ui-icon {
		position: absolute;
		inset: 0;
		width: 20px;
		height: 20px;
		transition: opacity 160ms ease, transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
	}

	.transaction-hide-eye-open {
		opacity: 1;
		transform: scale(1) rotate(0deg);
	}

	.transaction-hide-eye-closed {
		opacity: 0;
		transform: scale(0.72) rotate(-8deg);
	}

	&.hiding .transaction-hide-eye-open {
		opacity: 0;
		transform: scale(0.72) rotate(8deg);
	}

	&.hiding .transaction-hide-eye-closed {
		opacity: 1;
		transform: scale(1) rotate(0deg);
	}
`;
