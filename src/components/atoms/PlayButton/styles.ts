import styled from 'styled-components';

import { STYLING } from 'helpers/config';

export const Wrapper = styled.div`
	position: absolute;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
	width: 64px;
	height: 64px;
	background: rgba(0, 0, 0, 0.85);
	border-radius: 50%;
	display: flex;
	align-items: center;
	justify-content: center;
	cursor: pointer;
	transition: all 0.3s ease;
	opacity: 0;
	z-index: 20;
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);

	&:hover {
		background: rgba(0, 0, 0, 0.95);
		transform: translate(-50%, -50%) scale(1.15);
		opacity: 1;
		box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
	}

	svg {
		width: 28px;
		height: 28px;
		color: white;
	}

	/* Smaller size for list view thumbnails */
	&.list-view {
		width: 48px;
		height: 48px;

		svg {
			width: 20px;
			height: 20px;
		}

		&:hover {
			transform: translate(-50%, -50%) scale(1.1);
		}
	}
`;

export const PlayIcon = styled.div`
	display: flex;
	align-items: center;
	justify-content: center;
`;
