import styled from 'styled-components';

import { STYLING } from 'helpers/config';

export const Wrapper = styled.div``;

export const RangeBar = styled.input.attrs({ type: 'range' })<{ value: any; max: any; disabled: boolean }>`
	border: none !important;
	padding: 0 !important;
	background: ${(props) => props.theme.colors.container.primary.background} !important;
	width: 100%;
	appearance: none;
	height: 15px;
	outline: none;
	scroll-behavior: smooth;

	&::-webkit-slider-runnable-track {
		height: 12.5px;
		border-radius: ${STYLING.dimensions.radius.primary};
		background: ${(props) =>
			props.disabled
				? props.theme.colors.container.alt2.background
				: `linear-gradient(90deg, ${props.theme.colors.container.alt9.background} ${
						(props.value / props.max) * 100
				  }%, ${props.theme.colors.container.primary.background} ${(props.value / props.max) * 100}% )`};
		border: 1px solid ${(props) => props.theme.colors.border.primary};
		transition: background 0.1s;
		&:hover {
			background: ${(props) =>
				props.disabled
					? props.theme.colors.container.alt2.background
					: `linear-gradient(90deg, ${props.theme.colors.container.alt9.background} ${
							(props.value / props.max) * 100
					  }%, ${props.theme.colors.container.primary.active} ${(props.value / props.max) * 100}% )`};
			cursor: ${(props) => (props.disabled ? 'default' : 'pointer')};
		}
	}

	&::-moz-range-track {
		height: 12.5px;
		border-radius: ${STYLING.dimensions.radius.primary};
		background: ${(props) =>
			props.disabled
				? props.theme.colors.container.alt2.background
				: `linear-gradient(90deg, ${props.theme.colors.container.alt9.background} ${
						(props.value / props.max) * 100
				  }%, ${props.theme.colors.container.primary.background} ${(props.value / props.max) * 100}% )`};
		border: 1px solid ${(props) => props.theme.colors.border.primary};
		transition: background 0.1s;
		&:hover {
			background: ${(props) =>
				props.disabled
					? props.theme.colors.container.alt2.background
					: `linear-gradient(90deg, ${props.theme.colors.container.alt9.background} ${
							(props.value / props.max) * 100
					  }%, ${props.theme.colors.container.primary.active} ${(props.value / props.max) * 100}% )`};
			cursor: ${(props) => (props.disabled ? 'default' : 'pointer')};
		}
	}

	&::-ms-track {
		height: 12.5px;
		border-radius: ${STYLING.dimensions.radius.primary};
		background: ${(props) =>
			props.disabled
				? props.theme.colors.container.alt2.background
				: `linear-gradient(90deg, ${props.theme.colors.container.alt9.background} ${
						(props.value / props.max) * 100
				  }%, ${props.theme.colors.container.primary.background} ${(props.value / props.max) * 100}% )`};
		border: 1px solid ${(props) => props.theme.colors.border.primary};
		transition: background 0.1s;
		&:hover {
			background: ${(props) =>
				props.disabled
					? props.theme.colors.container.alt2.background
					: `linear-gradient(90deg, ${props.theme.colors.container.alt9.background} ${
							(props.value / props.max) * 100
					  }%, ${props.theme.colors.container.primary.active} ${(props.value / props.max) * 100}% )`};
			cursor: ${(props) => (props.disabled ? 'default' : 'pointer')};
		}
	}

	&::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		height: 26.5px;
		width: 9.5px;
		background: ${(props) =>
			props.disabled
				? props.theme.colors.button.primary.disabled.background
				: props.theme.colors.container.alt9.background};
		border: 1px solid ${(props) => props.theme.colors.border.primary};
		border-radius: 2.5px;
		cursor: ${(props) => (props.disabled ? 'default' : 'pointer')};
		margin-top: -6.5px;
	}

	&.custom-range::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		height: 26.5px;
		width: 9.5px;
		background: ${(props) =>
			props.disabled
				? props.theme.colors.button.primary.disabled.background
				: props.theme.colors.container.alt9.background};
		border: 1px solid ${(props) => props.theme.colors.border.primary};
		border-radius: 2.5px;
		cursor: ${(props) => (props.disabled ? 'default' : 'pointer')};
		margin-top: -7.5px;
	}

	&.custom-range::-moz-range-thumb {
		-webkit-appearance: none;
		appearance: none;
		height: 25.5px;
		width: 7.5px;
		background: ${(props) =>
			props.disabled
				? props.theme.colors.button.primary.disabled.background
				: props.theme.colors.container.alt9.background};
		border: 1px solid ${(props) => props.theme.colors.border.primary};
		border-radius: 2.5px;
		cursor: ${(props) => (props.disabled ? 'default' : 'pointer')};
		margin-top: -4.5px;
	}

	&::-webkit-slider-runnable-track:before {
		content: '';
		position: absolute;
		width: ${(props) => (props.value / props.max) * 100 + '%'};
		height: 15px;
		cursor: ${(props) => (props.disabled ? 'default' : 'pointer')}
		border-radius: ${STYLING.dimensions.radius.primary};
	}

	&::-ms-track:before {
		content: '';
		position: absolute;
		width: ${(props) => (props.value / props.max) * 100 + '%'};
		height: 15px;
		cursor: ${(props) => (props.disabled ? 'default' : 'pointer')}
		border-radius: ${STYLING.dimensions.radius.primary};
	}

	&::-moz-range-track:before {
		content: '';
		position: absolute;
		width: ${(props) => (props.value / props.max) * 100 + '%'};
		height: 15px;
		cursor: ${(props) => (props.disabled ? 'default' : 'pointer')}
		border-radius: ${STYLING.dimensions.radius.primary};
	}

	&::-webkit-slider-runnable-track:after {
		content: '';
		position: absolute;
		left: ${(props) => (props.value / props.max) * 100 + '%'};
		width: ${(props) => (1 - props.value / props.max) * 100 + '%'};
		height: 15px;
		background: ${(props) => props.theme.colors.container.primary.background};
		border-radius: ${STYLING.dimensions.radius.primary};
	}

	&::-ms-track:after {
		content: '';
		position: absolute;
		left: ${(props) => (props.value / props.max) * 100 + '%'};
		width: ${(props) => (1 - props.value / props.max) * 100 + '%'};
		height: 15px;
		background: ${(props) => props.theme.colors.container.primary.background};
		border-radius: ${STYLING.dimensions.radius.primary};
	}

	&::-moz-range-track:after {
		content: '';
		position: absolute;
		left: ${(props) => (props.value / props.max) * 100 + '%'};
		width: ${(props) => (1 - props.value / props.max) * 100 + '%'};
		height: 15px;
		background: ${(props) => props.theme.colors.container.primary.background};
		border-radius: ${STYLING.dimensions.radius.primary};
	}
`;

export const Input = styled(RangeBar)`
	width: 100%;
`;

export const LabelWrapper = styled.div`
	width: 100%;
	display: flex;
	align-items: center;
	justify-content: space-between;
	flex-wrap: wrap;
	gap: 10px;
	margin: 0 0 10px 0;
`;

export const Label = styled.div`
	p {
		color: ${(props) => props.theme.colors.font.alt1};
		font-size: ${(props) => props.theme.typography.size.xSmall};
		font-family: ${(props) => props.theme.typography.family.primary};
		font-weight: ${(props) => props.theme.typography.weight.bold};
	}
`;

export const Value = styled(Label)`
	p {
		color: ${(props) => props.theme.colors.font.primary};
		font-size: ${(props) => props.theme.typography.size.xSmall};
		font-family: ${(props) => props.theme.typography.family.alt1};
		font-weight: ${(props) => props.theme.typography.weight.bold};
	}
`;
