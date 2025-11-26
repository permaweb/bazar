import styled from 'styled-components';

import { fadeIn2, open } from 'helpers/animations';
import { STYLING } from 'helpers/config';

export const Wrapper = styled.div`
	height: 100%;
	display: flex;
	position: relative;
	animation: ${open} ${fadeIn2};
`;

export const PWrapper = styled.div`
	display: flex;
	align-items: center;
`;

export const CAction = styled.div`
	margin: 0 15px 0 0;
`;

export const LAction = styled.button`
	height: 35px;
	padding: 0 17.5px;
	margin: 0 15px 0 0;
	display: none;
	span {
		color: ${(props) => props.theme.colors.font.primary};
		font-family: ${(props) => props.theme.typography.family.alt1};
		font-size: ${(props) => props.theme.typography.size.base};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		display: block;
	}
	&:hover {
		background: ${(props) => props.theme.colors.container.primary.active};
	}
	@media (max-width: ${STYLING.cutoffs.initial}) {
		display: none;
	}
`;

export const MessageWrapper = styled.div`
	margin: 0 15px 0 0;

	@media (max-width: ${STYLING.cutoffs.initial}) {
		display: none !important;
	}
`;

export const LoadingWrapper = styled.div`
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	margin: 15px auto 0 auto;
	gap: 5px;

	span {
		color: ${(props) => props.theme.colors.font.primary};
		font-family: ${(props) => props.theme.typography.family.alt1};
		font-size: ${(props) => props.theme.typography.size.small};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		display: block;
	}
`;

export const FlexAction = styled.div`
	display: flex;
	align-items: center;
	svg {
		height: 25px;
		width: 20px;
		margin: 0 -2.5px 0 11.5px;
	}
`;

export const Dropdown = styled.ul`
	max-height: 85vh;
	width: 325px;
	max-width: 75vw;
	padding: 15px 0 10px 0;
	position: absolute;
	top: 45px;
	right: 0px;
	border-radius: ${STYLING.dimensions.radius.primary};
`;

export const DHeaderWrapper = styled.div`
	width: 100%;
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0 15px 5px 15px;
`;

export const DHeaderFlex = styled.div`
	display: flex;
	align-items: center;
`;

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

export const DNameWrapper = styled.div`
	display: flex;
	align-items: center;
	gap: 10px;
	position: relative;

	#vouch-check {
		height: 15.5px;
		width: 15.5px;
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		background: ${(props) => props.theme.colors.indicator.primary};
		border-radius: 50%;

		svg {
			height: 8.5px;
			width: 8.5px;
			color: ${(props) => props.theme.colors.font.light1};
			fill: ${(props) => props.theme.colors.font.light1};
			margin: 0 0 0.5px 0;
		}

		&:hover {
			${Tooltip} {
				display: block;
			}
		}
	}
`;

export const DHeader = styled.div`
	margin: 0 0 0 10px;
	p {
		position: relative;
		color: ${(props) => props.theme.colors.font.primary};
		font-family: ${(props) => props.theme.typography.family.alt1};
		font-size: ${(props) => props.theme.typography.size.base};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		&:hover {
			color: ${(props) => props.theme.colors.font.alt1};
		}
	}
	span {
		color: ${(props) => props.theme.colors.font.alt1};
		font-size: ${(props) => props.theme.typography.size.xxSmall};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		&:hover {
			color: ${(props) => props.theme.colors.font.primary};
		}
	}
	p,
	span {
		transition: all 100ms;
		&:hover {
			cursor: pointer;
		}
	}
`;

export const AddressWrapper = styled.div`
	display: flex;
	align-items: center;
	gap: 5px;
`;

export const CopyIconWrapper = styled.div`
	cursor: pointer;
	display: flex;
	align-items: center;
	justify-content: center;
	height: 16px;
	width: 16px;
	border-radius: 50%;
	transition: all 150ms ease;

	svg {
		height: 16px;
		width: 16px;
		color: ${(props) => props.theme.colors.font.alt1};
		fill: ${(props) => props.theme.colors.font.alt1};
		transition: all 100ms;
	}

	&:hover {
		background-color: ${(props) => props.theme.colors.container.primary.active};

		svg {
			color: ${(props) => props.theme.colors.font.primary};
			fill: ${(props) => props.theme.colors.font.primary};
		}
	}

	&:active {
		background-color: ${(props) => props.theme.colors.border.alt4};
		transform: scale(0.9);

		svg {
			color: ${(props) => props.theme.colors.font.primary};
			fill: ${(props) => props.theme.colors.font.primary};
		}
	}
`;

export const DBodyWrapper = styled.ul`
	width: 100%;
	padding: 10px 7.5px;
	border-bottom: 1px solid ${(props) => props.theme.colors.border.primary};
	li {
		text-align: center;
		height: 40.5px;
		display: flex;
		align-items: center;
		cursor: pointer;
		color: ${(props) => props.theme.colors.font.primary};
		font-family: ${(props) => props.theme.typography.family.primary};
		font-size: ${(props) => props.theme.typography.size.xSmall};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		border: 1px solid transparent;
		border-radius: ${STYLING.dimensions.radius.alt2};
		transition: all 100ms;
		padding: 0 7.5px;
		position: relative;
		svg {
			height: 15.5px;
			width: 15.5px;
			margin: 6.5px 8.5px 0 0;
			color: ${(props) => props.theme.colors.font.alt1};
			fill: ${(props) => props.theme.colors.font.alt1};
		}
		&:hover {
			color: ${(props) => props.theme.colors.font.primary};
			background: ${(props) => props.theme.colors.container.alt1.background};
		}

		&.active::after {
			content: '';
			position: absolute;
			right: 10px;
			width: 10px;
			height: 10px;
			background: ${(props) => props.theme.colors.indicator.primary};
			border-radius: 50%;
		}

		a {
			height: 100%;
			width: 100%;
			display: flex;
			align-items: center;
			border-radius: ${STYLING.dimensions.radius.primary};
			&:hover {
				color: ${(props) => props.theme.colors.font.primary};
				background: ${(props) => props.theme.colors.container.alt1.background};
			}
		}
	}

	p {
		color: ${(props) => props.theme.colors.font.alt1};
		font-family: ${(props) => props.theme.typography.family.primary};
		font-size: ${(props) => props.theme.typography.size.xSmall};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		padding: 7.5px;
	}
`;

export const DBalancesWrapper = styled(DBodyWrapper)`
	padding: 0 7.5px 10px 7.5px;
`;

export const DBalancesHeaderWrapper = styled.div`
	display: flex;
	justify-content: space-between;
	align-items: center;
	gap: 15px;
	margin: 7.5px 0 1.5px 0;

	button {
		padding: 7.5px 15.5px 7.5px 15.5px;
		margin: 0 7.5px 0 0;

		span {
			font-size: ${(props) => props.theme.typography.size.xxSmall} !important;
		}
	}
`;

export const DBalancesAction = styled.div`
	width: calc(100% - 30px);
	display: flex;
	justify-content: center;
	align-items: center;
	margin: 15px auto 5px auto;
`;

export const DBodyHeader = styled.div`
	margin: 0 0 2.5px 0;
	span {
		color: ${(props) => props.theme.colors.font.primary};
		font-family: ${(props) => props.theme.typography.family.alt1};
		font-size: ${(props) => props.theme.typography.size.base};
		font-weight: ${(props) => props.theme.typography.weight.bold};
	}
`;

export const BalanceLine = styled.div`
	height: 40px;
	display: flex;
	align-items: center;
	padding: 0 7.5px;
	span {
		font-size: ${(props) => props.theme.typography.size.base};
		font-family: ${(props) => props.theme.typography.family.alt1};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		color: ${(props) => props.theme.colors.font.primary};
	}
	svg {
		height: 16.5px;
		width: 16.5px;
		margin: 7.5px 7.5px 0 0;
		color: ${(props) => props.theme.colors.font.alt1};
		fill: ${(props) => props.theme.colors.font.alt1};
	}
	.pixl-icon {
		svg {
			fill: ${(props) => props.theme.colors.font.light1};
		}
	}
`;

export const TokenLink = styled.div`
	margin: 0 0 0 auto;
	a {
		width: 105px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: ${(props) => props.theme.colors.button.primary.background};
		border: 1px solid ${(props) => props.theme.colors.button.primary.border};
		padding: 1.5px 10.5px 3.5px 10.5px;
		border-radius: 36px;
		&:hover {
			background: ${(props) => props.theme.colors.button.primary.active.background};
			border: 1px solid ${(props) => props.theme.colors.button.primary.active.border};
			span {
				color: ${(props) => props.theme.colors.button.primary.active.color} !important;
			}
		}
		&:focus {
			background: ${(props) => props.theme.colors.button.primary.active.background};
			border: 1px solid ${(props) => props.theme.colors.button.primary.active.border};
			span {
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
			font-family: ${(props) => props.theme.typography.family.primary} !important;
			font-size: ${(props) => props.theme.typography.size.xxSmall} !important;
			font-weight: ${(props) => props.theme.typography.weight.bold} !important;
			color: ${(props) => props.theme.colors.button.primary.color} !important;
			text-align: center;
			padding: 2.5px 0 0 0;
		}
	}
`;

export const DFooterWrapper = styled(DBodyWrapper)`
	border-bottom: none;
	padding: 0 7.5px 10px 7.5px;
	svg {
		height: 15.5px;
		width: 15.5px;
		margin: 6.5px 8.5px 0 0;
		color: ${(props) => props.theme.colors.font.alt1};
		fill: ${(props) => props.theme.colors.font.alt1};
	}
`;

export const PManageWrapper = styled.div`
	max-width: 550px;
`;
