import styled, { css } from 'styled-components';

import { progressAnimation } from 'helpers/animations';
import { STYLING } from 'helpers/config';

export const Wrapper = styled.div`
	margin: 30px 0 0 0;
`;

export const InputWrapper = styled.div`
	margin: 30px 0 0 0;
`;

export const FieldsFlexWrapper = styled.div`
	width: 100%;
	display: flex;
	justify-content: space-between;
	@media (max-width: ${STYLING.cutoffs.initial}) {
		flex-direction: column;
		justify-content: flex-start;
		align-items: flex-start;
		gap: 15px;
	}
`;

export const TotalsWrapper = styled.div`
	width: fit-content;
	margin: 10px 0 0 0;
	> * {
		&:not(:last-child) {
			margin: 0 0 17.5px 0;
		}
		&:last-child {
			margin: 0;
		}
	}
`;

export const TotalQuantityLine = styled.div`
	display: flex;
	flex-direction: column;
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

export const FieldsWrapper = styled.div`
	width: 50%;
	display: flex;
	flex-direction: column;
	align-items: flex-end;
	flex-wrap: wrap;
	@media (max-width: ${STYLING.cutoffs.tablet}) {
		width: 100%;
	}
`;

export const FieldWrapper = styled.div`
	width: 100%;
	input {
		height: 55px !important;
		font-size: ${(props) => props.theme.typography.size.lg} !important;
	}
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
	margin: 0 0 20px 0;
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

	@media (max-width: ${STYLING.cutoffs.secondary}) {
		flex-direction: column;
		justify-content: flex-start;
		align-items: flex-start;
		gap: 15px;
	}
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

export const ActionWrapper = styled.div<{ loading: boolean | string }>`
	width: 100%;
	position: relative;
	margin: 20px 0 0 0;
	button {
		${(props) =>
			props.loading === 'true' &&
			css`
				&::after {
					content: '';
					display: block;
					position: absolute;
					top: 0;
					left: 0;
					right: 0;
					bottom: 0;
					z-index: 0;
					background-image: linear-gradient(
						-45deg,
						${props.theme.colors.container.alt9.background} 25%,
						${props.theme.colors.container.alt10.background} 25%,
						${props.theme.colors.container.alt10.background} 50%,
						${props.theme.colors.container.alt9.background} 50%,
						${props.theme.colors.container.alt9.background} 75%,
						${props.theme.colors.container.alt10.background} 75%,
						${props.theme.colors.container.alt10.background}
					);
					background-size: 60px 60px;
					animation: ${progressAnimation} 2s linear infinite;
				}
			`}

		span,
		svg {
			position: relative;
			z-index: 1;
		}
		span {
			font-size: clamp(18px, 2vw, 24px) !important;
			font-family: ${(props) => props.theme.typography.family.alt1};
			text-transform: uppercase;
			white-space: nowrap;
		}
		svg {
			height: 25px;
			width: 25px;
			margin: 0 15px 0 0;
		}

		&:disabled {
			span {
				color: ${(props) =>
					props.loading ? props.theme.colors.font.light1 : props.theme.colors.button.primary.disabled.color} !important;
			}
			svg {
				color: ${(props) =>
					props.loading ? props.theme.colors.font.light1 : props.theme.colors.button.primary.disabled.color} !important;
			}
		}
	}
	button {
		min-width: 0;
		width: 100%;
	}
`;

export const ActionWrapperFull = styled(ActionWrapper)`
	width: 100%;
	margin: 20px 0 0 0;
`;

export const ConfirmationFooter = styled.div`
	width: 100%;
	margin: 10px 0 0 0;
	p {
		font-size: ${(props) => props.theme.typography.size.xSmall};
		font-family: ${(props) => props.theme.typography.family.primary};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		color: ${(props) => props.theme.colors.font.alt1};
		a {
			text-decoration: underline;
			text-decoration-thickness: 1.25px;
		}
	}
`;

export const MessageWrapper = styled.div<{ warning?: boolean }>`
	padding: 3.5px 10px;
	margin: 15px 0 0 0;
	display: flex;
	align-items: center;
	justify-content: center;
	background: ${(props) =>
		props.warning ? props.theme.colors.warning.primary : props.theme.colors.container.alt11.background};
	border: 1px solid ${(props) => (props.warning ? props.theme.colors.warning.primary : props.theme.colors.border.alt3)};
	border-radius: ${STYLING.dimensions.radius.alt1};
	span {
		font-size: ${(props) => props.theme.typography.size.xSmall};
		font-family: ${(props) => props.theme.typography.family.alt1};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		color: ${(props) => props.theme.colors.font.light1};
		text-align: center;
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
	@media (max-width: ${STYLING.cutoffs.initial}) {
		button {
			display: none;
		}
	}
`;
