import styled from 'styled-components';

import { shine } from 'helpers/animations';
import { STYLING } from 'helpers/config';

export const Wrapper = styled.div`
	min-height: calc(100vh - (${STYLING.dimensions.nav.height} + 20px));
	width: 100%;
	background-image: url('https://arweave.net/BX69ET09R9FrjOA69RokJ9pFXuWw7wlAyaLUG269a2g');
	background-size: cover;
	background-position: center;
	padding: 40px 20px;
`;

export const Header = styled.div`
	display: flex;
	flex-direction: column;
	gap: 5px;
	align-items: center;
	margin: 20px 0 0 0;

	h1,
	p {
		color: ${(props) => props.theme.colors.font.light1};
		text-align: center;
	}

	h1 {
		font-weight: ${(props) => props.theme.typography.weight.xBold};
		text-shadow: 1.5px 3.5px #80f154;
	}

	p {
		line-height: 1.5;
		max-width: 800px;
		font-family: ${(props) => props.theme.typography.family.alt1};
		font-size: ${(props) => props.theme.typography.size.base};
		font-weight: ${(props) => props.theme.typography.weight.bold};
	}
`;

export const ProfileWrapper = styled.div<{ completed: boolean }>`
	max-width: 90%;
	background: rgba(10, 10, 10, 0.65);
	padding: 10px 20px;
	border-radius: ${STYLING.dimensions.radius.alt2};
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 15px;
	margin: 20px 0 0 0;
	pointer-events: ${(props) => (props.completed ? 'none' : 'auto')};
	transition: all 100ms;

	span {
		color: #7ec9bf;
		color: ${(props) => props.theme.colors.font.light1};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		font-size: ${(props) => props.theme.typography.size.lg};
	}

	&:hover {
		cursor: ${(props) => (props.completed ? 'default' : 'pointer')};
		background: ${(props) => (props.completed ? 'rgba(10, 10, 10, 0.65)' : 'rgba(30, 30, 30, 0.65)')};
	}
`;

export const ProfileIndicator = styled.div<{ completed: boolean }>`
	width: 17.5px;
	height: 17.5px;
	background: ${(props) =>
		props.completed ? props.theme.colors.indicator.active : props.theme.colors.warning.primary};
	background: ${(props) => (props.completed ? '#80F154' : props.theme.colors.warning.primary)};
	border-radius: 50%;
`;

export const Body = styled.div`
	width: 100%;
	display: flex;
	gap: 20px;
	padding: 0 20px;
	margin: 40px 0 0 0;
	flex-wrap: wrap;
	justify-content: center;
	align-items: center;
`;

export const GridElement = styled.div`
	position: relative;
	overflow: hidden;

	img {
		height: 500px;
	}

	&.shine::after {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: linear-gradient(135deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0.2));
		transform: translate(-150%, 150%);
		animation: ${shine} 1s ease-out forwards;
	}

	@keyframes shine {
		to {
			transform: translate(150%, -150%);
		}
	}
`;

export const GridElementOverlay = styled.div`
	height: 370px;
	width: calc(100% - 50px);
	display: flex;
	justify-content: center;
	align-items: center;
	position: absolute;
	top: 24.5px;
	left: 24.5px;
	display: flex;
	background: rgba(15, 15, 15, 0.55);
	backdrop-filter: blur(10px);
	border-radius: ${STYLING.dimensions.radius.alt2};

	svg {
		height: 150px;
		width: 150px;
		color: ${(props) => props.theme.colors.font.light1};
		fill: ${(props) => props.theme.colors.font.light1};
	}
`;

export const GridElementAction = styled.button`
	width: calc(100% - 20px);
	background: ${(props) => props.theme.colors.indicator.active};
	padding: 10px 20px;
	border-radius: ${STYLING.dimensions.radius.primary};
	background: linear-gradient(180deg, #80f154, #bbe948, #efe13e);
	box-shadow: 0 0 25px 5px #80f154;
	border: 1px solid #0d3f0a;
	transition: all 200ms;
	span {
		color: #0d3f0a;
		font-family: ${(props) => props.theme.typography.family.alt1};
		font-weight: ${(props) => props.theme.typography.weight.xBold};
		font-size: ${(props) => props.theme.typography.size.lg};
	}

	&:hover {
		background: #0d3f0a;
		box-shadow: 0 0 25px 5px #666666;
		border: 1px solid #12580e;
		span {
			color: ${(props) => props.theme.colors.font.light1};
		}
	}

	&:disabled {
		background: #0d3f0a;
		box-shadow: 0 0 25px 5px #666666;
		border: 1px solid #12580e;
		span {
			color: ${(props) => props.theme.colors.font.light1};
		}
	}
`;

export const PManageWrapper = styled.div`
	max-width: 550px;
`;
