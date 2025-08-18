import styled from 'styled-components';

export const AvatarContainer = styled.div<{ size: number }>`
	position: relative;
	width: ${(props) => props.size}px;
	height: ${(props) => props.size}px;
	border-radius: 50%;
	overflow: visible;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
`;

export const RingBorder = styled.div<{ color: string; size: number; isGlowing?: boolean }>`
	position: absolute;
	top: -3px;
	left: -3px;
	right: -3px;
	bottom: -3px;
	border: 3px solid ${(props) => props.color};
	border-radius: 50%;
	z-index: 1;
	box-shadow: 0 0 10px ${(props) => props.color}40;

	${(props) =>
		props.size > 80 &&
		`
		border-width: 4px;
		top: -4px;
		left: -4px;
		right: -4px;
		bottom: -4px;
	`}

	${(props) =>
		props.isGlowing &&
		`
		animation: wanderGlow 2s ease-in-out infinite alternate;
		box-shadow: 
			0 0 10px ${props.color},
			0 0 20px ${props.color}80,
			0 0 30px ${props.color}60;
	`}
	
	@keyframes wanderGlow {
		from {
			box-shadow: 0 0 10px ${(props) => props.color}, 0 0 20px ${(props) => props.color}80,
				0 0 30px ${(props) => props.color}60;
		}
		to {
			box-shadow: 0 0 15px ${(props) => props.color}, 0 0 25px ${(props) => props.color}90,
				0 0 35px ${(props) => props.color}80;
		}
	}
`;

export const AvatarInner = styled.div`
	width: 100%;
	height: 100%;
	border-radius: 50%;
	overflow: hidden;
	background-color: #2a2a2a;
	display: flex;
	align-items: center;
	justify-content: center;
	position: relative;
	z-index: 2;
`;

export const Avatar = styled.img`
	width: 100%;
	height: 100%;
	border-radius: 50%;
	object-fit: cover;
	position: absolute;
	top: 0;
	left: 0;
`;

export const DefaultAvatar = styled.div<{ size: number }>`
	width: 70%;
	height: 70%;
	display: flex;
	align-items: center;
	justify-content: center;

	svg {
		width: 100%;
		height: 100%;
		opacity: 0.7;
	}
`;
