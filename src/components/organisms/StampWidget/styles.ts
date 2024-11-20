import styled from 'styled-components';

export const Wrapper = styled.button`
	position: relative;
	height: 35px;
	width: fit-content !important;

	padding: 0 15px;
	display: flex;
	align-items: center;
	gap: 7.5px;

	background: ${(props) => props.theme.colors.container.primary.background};
	cursor: pointer;
	&:hover {
		background: ${(props) => props.theme.colors.container.primary.active};
		cursor: pointer;
	}
	&:disabled {
		background: ${(props) => props.theme.colors.container.primary.active};
		cursor: default;
	}
	p {
		color: ${(props) => props.theme.colors.font.primary};
		font-family: ${(props) => props.theme.typography.family.alt1};
		font-size: ${(props) => props.theme.typography.size.xSmall};
		font-weight: ${(props) => props.theme.typography.weight.bold};
	}
	svg {
		transition: all 300ms;
		margin: 3.5px 0 0 0;
		height: 17.5px;
		width: 17.5px !important;
	}
`;

export const Button = styled.button`
	position: relative;
	display: flex;
	align-items: center;
	background-color: ${(props) => props.theme.colors.button.primary.background};
	color: ${(props) => props.theme.colors.font.primary};
	padding: 10px;
	border: none;
	border-radius: 4px;
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
		color: ${(props) => props.theme.colors.button.primary.color} !important;
	}
`;

export const Tooltip = styled.div`
	position: absolute;
	bottom: -30px;
	left: 50%;
	transform: translateX(-50%);
	padding: 5px 5px;
	border-radius: 4px;
	font-size: ${(props) => props.theme.typography.size.xxxsmall};
	visibility: hidden;
	transition: opacity 0.3s, visibility 0.3s;
	white-space: nowrap;

	${Wrapper}:hover &,
	${Button}:hover & {
		opacity: 1;
		visibility: visible;
	}
`;
