import styled from 'styled-components';

export const Tooltip = styled.div<{ useBottom: boolean }>`
	position: absolute;
	top: ${(props) => (props.useBottom ? 'auto' : '-25px')};
	bottom: ${(props) => (props.useBottom ? '-25px' : 'auto')};
	left: 50%;
	transform: translate(-50%, 0);
	z-index: 1;
	display: none;
	span {
		display: block;
		line-height: 1.65;
	}
`;

export const Wrapper = styled.div`
	position: relative;
	height: fit-content;
	width: fit-content;
	&:hover {
		${Tooltip} {
			display: block;
		}
	}
`;

export const Primary = styled.button<{
	dimensions: { wrapper: number; icon: number } | undefined;
	sm: boolean | undefined;
	warning: boolean | undefined;
	disabled: boolean | undefined;
	active: boolean | undefined;
}>`
	height: ${(props) => (props.dimensions ? `${props.dimensions.wrapper.toString()}px` : `42.5px`)};
	width: ${(props) => (props.dimensions ? `${props.dimensions.wrapper.toString()}px` : `42.5px`)};
	display: flex;
	justify-content: center;
	align-items: center;
	padding: 4.5px 0 0 0;
	pointer-events: ${(props) => (props.disabled ? 'none' : 'all')};
	border-radius: 50%;

	svg {
		height: ${(props) => (props.dimensions ? `${props.dimensions.icon.toString()}px` : `24.5px`)};
		width: ${(props) => (props.dimensions ? `${props.dimensions.icon.toString()}px` : `24.5px`)};
		fill: ${(props) =>
			props.disabled
				? props.theme.colors.icon.primary.disabled
				: props.active
				? props.theme.colors.icon.primary.fill
				: props.theme.colors.icon.primary.fill};
	}
	&:hover {
		background: ${(props) => props.theme.colors.icon.primary.active};
	}
`;

export const Alt1 = styled(Primary)`
	background: ${(props) =>
		props.active
			? props.theme.colors.button.primary.active.background
			: props.disabled
			? props.theme.colors.button.primary.disabled.background
			: props.theme.colors.button.primary.background};
	border: 1px solid
		${(props) =>
			props.active
				? props.theme.colors.button.primary.active.border
				: props.disabled
				? props.theme.colors.button.primary.disabled.border
				: props.theme.colors.button.primary.border};
	svg {
		height: ${(props) => (props.dimensions ? `${props.dimensions.icon.toString()}px` : `24.5px`)};
		width: ${(props) => (props.dimensions ? `${props.dimensions.icon.toString()}px` : `24.5px`)};
		fill: ${(props) =>
			props.active
				? props.theme.colors.font.light1
				: props.disabled
				? props.theme.colors.button.primary.disabled.color
				: props.theme.colors.button.primary.color};
	}

	&:hover {
		background: ${(props) =>
			props.disabled
				? props.theme.colors.button.primary.disabled.background
				: props.theme.colors.button.primary.active.background};
		svg {
			fill: ${(props) =>
				props.disabled ? props.theme.colors.button.primary.disabled.color : props.theme.colors.font.light1};
		}
	}
`;
