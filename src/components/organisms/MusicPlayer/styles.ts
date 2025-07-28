import styled from 'styled-components';

import { STYLING } from 'helpers/config';

export const Wrapper = styled.div`
	position: fixed;
	bottom: 0;
	left: 0;
	right: 0;
	height: 80px;
	background: ${(props) => props.theme.colors.container.primary.background};
	border-top: 1px solid ${(props) => props.theme.colors.border.alt1};
	z-index: 1000;
	padding: 0 20px;
`;

export const PlayerContent = styled.div`
	display: flex;
	align-items: center;
	justify-content: space-between;
	height: 100%;
	max-width: 1200px;
	margin: 0 auto;
	gap: 20px;
`;

export const TrackInfo = styled.div`
	display: flex;
	align-items: center;
	gap: 15px;
	flex: 1;
	min-width: 0; /* Allow text truncation */

	@media (max-width: 600px) {
		display: none;
	}
`;

export const CoverArt = styled.div`
	width: 56px;
	height: 56px;
	border-radius: 8px;
	overflow: hidden;
	background: ${(props) => props.theme.colors.container.alt2.background};
	display: flex;
	align-items: center;
	justify-content: center;
	position: relative;

	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	svg {
		width: 24px;
		height: 24px;
		color: ${(props) => props.theme.colors.font.alt1};
	}
`;

export const TrackDetails = styled.div`
	display: flex;
	flex-direction: column;
	gap: 4px;
`;

export const TrackTitle = styled.span`
	color: ${(props) => props.theme.colors.font.primary};
	font-size: ${(props) => props.theme.typography.size.small};
	font-weight: ${(props) => props.theme.typography.weight.medium};
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	max-width: 200px;
`;

export const TrackArtist = styled.span`
	color: ${(props) => props.theme.colors.font.alt1};
	font-size: ${(props) => props.theme.typography.size.xSmall};
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	max-width: 200px;
`;

export const PlaybackControls = styled.div`
	display: flex;
	align-items: center;
	gap: 20px;
	flex: 1;
	justify-content: center;
`;

export const ControlButton = styled.button`
	background: none;
	border: none;
	cursor: pointer;
	padding: 8px;
	border-radius: 50%;
	display: flex;
	align-items: center;
	justify-content: center;
	transition: background-color 0.2s ease;

	&:hover {
		background: ${(props) => props.theme.colors.container.alt2.background};
	}

	svg {
		width: 20px;
		height: 20px;
		color: ${(props) => props.theme.colors.font.primary};
	}
`;

export const PlayPauseButton = styled(ControlButton)`
	width: 48px;
	height: 48px;
	background: ${(props) => props.theme.colors.container.primary.background};
	border: 1px solid ${(props) => props.theme.colors.border.alt1};

	&:hover {
		background: ${(props) => props.theme.colors.container.alt2.background};
	}

	svg {
		width: 24px;
		height: 24px;
	}
`;

export const ProgressSection = styled.div`
	display: flex;
	flex-direction: column;
	gap: 12px;
	flex: 1;
	align-items: flex-end;
`;

export const ProgressBar = styled.div`
	width: 200px;

	input[type='range'] {
		width: 100%;
		height: 6px;
		border-radius: 3px;
		background: ${(props) => props.theme.colors.container.alt2.background};
		outline: none;
		-webkit-appearance: none;

		&::-webkit-slider-thumb {
			-webkit-appearance: none;
			appearance: none;
			width: 14px;
			height: 14px;
			border-radius: 50%;
			background: ${(props) => props.theme.colors.font.primary};
			cursor: pointer;
			box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
		}

		&::-moz-range-thumb {
			width: 14px;
			height: 14px;
			border-radius: 50%;
			background: ${(props) => props.theme.colors.font.primary};
			cursor: pointer;
			border: none;
			box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
		}
	}
`;

export const ControlsRow = styled.div`
	display: flex;
	align-items: center;
	gap: 20px;
`;

export const TimeDisplay = styled.div`
	display: flex;
	gap: 8px;
	font-size: ${(props) => props.theme.typography.size.xSmall};
	color: ${(props) => props.theme.colors.font.alt1};
	font-weight: ${(props) => props.theme.typography.weight.medium};
`;

export const VolumeControl = styled.div`
	display: flex;
	align-items: center;
	gap: 10px;

	svg {
		width: 16px;
		height: 16px;
		color: ${(props) => props.theme.colors.font.alt1};
	}

	input[type='range'] {
		width: 100px;
		height: 6px;
		border-radius: 3px;
		background: ${(props) => props.theme.colors.container.alt2.background};
		outline: none;
		-webkit-appearance: none;

		&::-webkit-slider-thumb {
			-webkit-appearance: none;
			appearance: none;
			width: 14px;
			height: 14px;
			border-radius: 50%;
			background: ${(props) => props.theme.colors.font.primary};
			cursor: pointer;
			box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
		}

		&::-moz-range-thumb {
			width: 14px;
			height: 14px;
			border-radius: 50%;
			background: ${(props) => props.theme.colors.font.primary};
			cursor: pointer;
			border: none;
			box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
		}
	}
`;

export const LoadingIndicator = styled.div`
	position: absolute;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
	width: 20px;
	height: 20px;

	div {
		width: 100%;
		height: 100%;
		border: 2px solid ${(props) => props.theme.colors.border.alt1};
		border-top: 2px solid ${(props) => props.theme.colors.font.primary};
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}
`;
