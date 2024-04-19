import styled from 'styled-components';

import { STYLING } from 'helpers/config';

export const Wrapper = styled.div`
	margin: 30px 0 0 0;
`;

export const TotalsWrapper = styled.div`
	width: fit-content;
	> * {
		&:not(:last-child) {
			margin: 0 0 7.5px 0;
		}
		&:first-child {
			padding: 0 0 7.5px 0;
			border-bottom: 1px solid ${(props) => props.theme.colors.border.primary};
		}
		&:last-child {
			margin: 0;
		}
	}
`;

export const TotalQuantityLine = styled.div`
	display: flex;
	align-items: center;
	p,
	span {
		font-size: ${(props) => props.theme.typography.size.base};
		font-family: ${(props) => props.theme.typography.family.primary};
		font-weight: ${(props) => props.theme.typography.weight.medium};
		color: ${(props) => props.theme.colors.font.alt1};
		word-wrap: break-word;
	}
	span {
		color: ${(props) => props.theme.colors.font.primary};
		font-family: ${(props) => props.theme.typography.family.alt1};
		font-weight: ${(props) => props.theme.typography.weight.bold};
	}
`;

export const InputWrapper = styled.div`
	margin: 30px 0 0 0;
`;

export const FieldsWrapper = styled.div`
	width: 100%;
	display: flex;
	justify-content: space-between;
	flex-wrap: wrap;
`;

export const FieldWrapper = styled.div`
	width: 350px;
	max-width: 47.5%;
	@media (max-width: ${STYLING.cutoffs.tablet}) {
		width: 100%;
		max-width: none;
	}
`;

export const MaxQty = styled.div`
	width: fit-content;
	margin: 10px 0 0 auto;
`;

export const SalesWrapper = styled.div`
	margin: 20px 0 0 0;
	> * {
		&:not(:last-child) {
			margin: 0 0 15px 0;
		}
		&:last-child {
			margin: 0;
		}
	}
`;

export const SalesLine = styled.div`
	display: flex;
	justify-content: space-between;
	align-items: center;
`;

export const SalesDetail = styled.div`
	span {
		font-size: ${(props) => props.theme.typography.size.base};
		font-family: ${(props) => props.theme.typography.family.primary};
		font-weight: ${(props) => props.theme.typography.weight.medium};
		color: ${(props) => props.theme.colors.font.alt1};
	}
	p {
		font-size: ${(props) => props.theme.typography.size.xLg};
		font-family: ${(props) => props.theme.typography.family.alt1};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		color: ${(props) => props.theme.colors.font.primary};
	}
	img {
		height: 22.5px;
		width: 22.5px;
		margin: 5px 0 0 2.5px;
	}
	> * {
		span {
			font-size: ${(props) => props.theme.typography.size.xLg};
			font-family: ${(props) => props.theme.typography.family.alt1};
			font-weight: ${(props) => props.theme.typography.weight.bold};
			color: ${(props) => props.theme.colors.font.primary};
		}
	}
`;

export const ActionWrapper = styled.div<{ loading: boolean | string; statusWidth: number }>`
	width: fit-content;
	margin: 30px 0 0 auto;
	position: relative;
	button {
		z-index: 1;
		span,
		svg {
			position: relative;
			z-index: 2;
		}
		span {
			font-size: clamp(18px, 2vw, 24px) !important;
			font-family: ${(props) => props.theme.typography.family.alt1};
			text-transform: uppercase;
			white-space: nowrap;
		}
		svg {
			height: 22.5px;
			width: 22.5px;
			margin: 0 15px 0 0;
		}

		&:disabled {
			span {
				color: ${(props) =>
					props.loading || props.statusWidth > 0
						? props.theme.colors.font.light1
						: props.theme.colors.button.primary.disabled.color} !important;
			}
			svg {
				fill: ${(props) =>
					props.loading || props.statusWidth > 0
						? props.theme.colors.font.light1
						: props.theme.colors.button.primary.disabled.color} !important;
			}
		}

		&::after {
			content: '';
			display: block;
			position: absolute;
			top: 0;
			left: 0;
			height: 100%;
			width: ${(props) => `${props.statusWidth.toString()}%`};
			background: ${(props) => props.theme.colors.container.alt9.background};
			transition: width 0.25s ease;
			clip-path: ${(props) =>
				props.statusWidth >= 100
					? 'none'
					: 'polygon(0 0, calc(100% - 20px) 0, 100% 50%, calc(100% - 20px) 100%, 0 100%)'};
		}
	}
	@media (max-width: ${STYLING.cutoffs.secondary}) {
		width: 100%;
		margin: 20px 0 0 0;
		button {
			min-width: 0;
			width: 100%;
		}
	}
`;

export const ActionWrapperFull = styled(ActionWrapper)`
	width: 100%;
	margin: 20px 0 0 0;
`;

export const MessageWrapper = styled.div`
	margin: 10px 0 0 0;
	span {
		font-size: ${(props) => props.theme.typography.size.small};
		font-family: ${(props) => props.theme.typography.family.primary};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		color: ${(props) => props.theme.colors.warning.primary};
	}
`;

export const ConfirmationWrapper = styled.div``;

export const ConfirmationMessage = styled.div`
	width: fit-content;
	margin: 20px 0 0 0;
	p {
		font-size: ${(props) => props.theme.typography.size.xSmall};
		font-family: ${(props) => props.theme.typography.family.alt1};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		color: ${(props) => props.theme.colors.font.primary};
	}
`;

export const RecipientWrapper = styled.div`
	width: 100%;
	display: flex;
	flex-wrap: wrap;
	gap: 10px;
	button {
		margin: 30.5px 0 0 0;
	}
`;
