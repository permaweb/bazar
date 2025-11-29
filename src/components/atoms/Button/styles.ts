import styled from 'styled-components';

import { STYLING } from 'helpers/config';

function getHeight(height: number | undefined) {
	if (height) {
		return `${height.toString()}px`;
	} else {
		return STYLING.dimensions.button.height;
	}
}

function getWidth(_noMinWidth: boolean | undefined, width: number | undefined, fullWidth: boolean | undefined) {
	if (fullWidth) {
		return `100%`;
	} else if (width) {
		return `${width}px`;
	} else return 'fit-content';
}

export const Tooltip = styled.div<{ useBottom: boolean }>`
	position: absolute;
	top: ${(props) => (props.useBottom ? 'auto' : '-25px')};
	bottom: ${(props) => (props.useBottom ? '-25px' : 'auto')};
	left: 50%;
	transform: translate(-50%, 0);
	z-index: 1;
	display: none;
`;

export const Wrapper = styled.div`
	position: relative;
	width: fit-content;
	&:hover {
		${Tooltip} {
			display: block;
		}
	}
`;

export const Primary = styled.button<{
	useMaxWidth: boolean | undefined;
	noMinWidth: boolean | undefined;
	width: number | undefined;
	fullWidth: boolean | undefined;
	height: number | undefined;
	active: boolean | undefined;
}>`
	position: relative;
	background: ${(props) =>
		props.active ? props.theme.colors.button.primary.active.background : props.theme.colors.button.primary.background};
	height: ${(props) => getHeight(props.height)};
	min-width: ${(props) => getWidth(props.noMinWidth, props.width, props.fullWidth)};
	max-width: ${(props) => (props.useMaxWidth ? STYLING.dimensions.button.width : '100%')};
	overflow: hidden;
	text-overflow: ellipsis;
	padding: 1.5px 15px 0 15px;
	display: flex;
	align-items: center;
	justify-content: center;
	border: 1px solid
		${(props) =>
			props.active ? props.theme.colors.button.primary.active.border : props.theme.colors.button.primary.border};
	border-radius: ${STYLING.dimensions.button.radius};
	&:hover {
		background: ${(props) => props.theme.colors.button.primary.active.background};
		border: 1px solid ${(props) => props.theme.colors.button.primary.active.border};
		span {
			color: ${(props) => props.theme.colors.button.primary.active.color} !important;
		}
		svg {
			color: ${(props) => props.theme.colors.button.primary.active.color} !important;
		}
	}
	&:focus {
		background: ${(props) => props.theme.colors.button.primary.active.background};
		border: 1px solid ${(props) => props.theme.colors.button.primary.active.border};
		span {
			color: ${(props) => props.theme.colors.button.primary.active.color} !important;
		}
		svg {
			color: ${(props) => props.theme.colors.button.primary.active.color} !important;
		}
	}
	&:disabled {
		background: ${(props) => props.theme.colors.button.primary.disabled.background};
		border: 1px solid ${(props) => props.theme.colors.button.primary.disabled.border};
		span {
			color: ${(props) => props.theme.colors.button.primary.disabled.color} !important;
		}
		svg {
			color: ${(props) => props.theme.colors.button.primary.disabled.color} !important;
		}
	}

	span {
		width: fit-content;
		text-overflow: ellipsis;
		overflow: hidden;
		font-size: ${(props) => props.theme.typography.size.xSmall} !important;
		font-weight: ${(props) => props.theme.typography.weight.bold} !important;
		color: ${(props) =>
			props.active
				? props.theme.colors.button.primary.active.color
				: props.theme.colors.button.primary.color} !important;
	}
`;

export const IconPrimary = styled.div<{
	active: boolean;
	disabled: boolean;
	leftAlign: boolean;
}>`
	svg {
		height: 15px;
		width: 15px;
		padding: 1.5px 0 0 0;
		margin: ${(props) => (props.leftAlign ? '0 7.5px 0 0' : '0 0 0 7.5px')};
		color: ${(props) =>
			props.disabled
				? props.theme.colors.button.primary.disabled.color
				: props.active
				? props.theme.colors.button.primary.active.color
				: props.theme.colors.button.primary.color};
	}
`;

export const Alt1 = styled(Primary)`
	background: ${(props) =>
		props.active ? props.theme.colors.button.alt1.active.background : props.theme.colors.button.alt1.background};
	border: 1px solid
		${(props) => (props.active ? props.theme.colors.button.alt1.active.border : props.theme.colors.button.alt1.border)};

	&:hover {
		background: ${(props) => props.theme.colors.button.alt1.active.background};
		border: 1px solid ${(props) => props.theme.colors.button.alt1.active.border};
	}

	&:focus {
		background: ${(props) =>
			props.active
				? props.theme.colors.button.alt1.active.background
				: props.theme.colors.button.alt1.active.background};
		border: 1px solid ${(props) => props.theme.colors.button.alt1.active.border};
	}

	span {
		width: fit-content;
		text-overflow: ellipsis;
		overflow: hidden;
		font-size: ${(props) => props.theme.typography.size.xSmall} !important;
		font-weight: ${(props) => props.theme.typography.weight.bold} !important;
		color: ${(props) =>
			props.active ? props.theme.colors.button.alt1.active.color : props.theme.colors.button.alt1.color} !important;
	}

	&:hover {
		span {
			color: ${(props) => props.theme.colors.button.alt1.active.color} !important;
		}
		svg {
			color: ${(props) => props.theme.colors.button.alt1.active.color} !important;
			fill: ${(props) => props.theme.colors.button.alt1.active.color} !important;
		}
	}

	&:focus {
		span {
			color: ${(props) => props.theme.colors.button.alt1.active.color} !important;
		}
		svg {
			color: ${(props) => props.theme.colors.button.alt1.active.color} !important;
			fill: ${(props) => props.theme.colors.button.alt1.active.color} !important;
		}
	}

	&:disabled {
		background: ${(props) => props.theme.colors.button.alt1.disabled.background};
		border: 1px solid ${(props) => props.theme.colors.button.alt1.disabled.border};
		span {
			color: ${(props) => props.theme.colors.button.alt1.disabled.color} !important;
		}
		svg {
			color: ${(props) => props.theme.colors.button.alt1.disabled.color} !important;
		}
	}
`;

export const IconAlt1 = styled(IconPrimary)`
	svg {
		color: ${(props) =>
			props.disabled
				? props.theme.colors.button.alt1.disabled.color
				: props.active
				? props.theme.colors.button.alt1.active.color
				: props.theme.colors.button.alt1.color};
	}
`;

export const Alt2 = styled(Alt1)`
	height: fit-content;
	min-height: 0;
	width: fit-content;
	min-width: 0;
	padding: 0;
	background: transparent !important;
	border: none !important;
	border-radius: 0;

	&:hover {
		span {
			color: ${(props) => props.theme.colors.button.alt2.active.color} !important;
		}
	}

	&:focus {
		span {
			color: ${(props) => props.theme.colors.button.alt2.active.color} !important;
		}
	}

	&:disabled {
		background: ${(props) => props.theme.colors.button.alt2.disabled.background};
		border: 1px solid ${(props) => props.theme.colors.button.alt2.disabled.border};
		span {
			color: ${(props) => props.theme.colors.button.alt2.disabled.color} !important;
		}
	}

	span {
		width: fit-content;
		text-overflow: ellipsis;
		overflow: hidden;
		font-size: ${(props) => props.theme.typography.size.xSmall} !important;
		font-weight: ${(props) => props.theme.typography.weight.bold} !important;
		color: ${(props) =>
			props.active ? props.theme.colors.button.alt2.active.color : props.theme.colors.button.alt2.color} !important;
	}
`;

export const IconAlt2 = styled(IconAlt1)`
	svg {
		color: ${(props) =>
			props.disabled
				? props.theme.colors.button.alt2.disabled.color
				: props.active
				? props.theme.colors.button.alt2.active.color
				: props.theme.colors.button.alt2.color};
	}
`;
