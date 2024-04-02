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
`;

export const ActionWrapper = styled.div`
	width: fit-content;
	margin: 30px 0 0 auto;
	button {
		span {
			font-size: ${(props) => props.theme.typography.size.xLg} !important;
			font-family: ${(props) => props.theme.typography.family.alt1};
			text-transform: uppercase;
		}
		svg {
			height: 22.5px;
			width: 22.5px;
			margin: 0 15px 0 0;
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

export const ConfirmationWrapper = styled.div``;

export const ConfirmationMessage = styled.div`
	width: fit-content;
	margin: 20px 0 0 0;
	// padding: 6.5px 15.5px;
	// background: ${(props) => props.theme.colors.container.alt10.background};
	// border-radius: ${STYLING.dimensions.radius.primary};
	p {
		font-size: ${(props) => props.theme.typography.size.small};
		font-family: ${(props) => props.theme.typography.family.primary};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		color: ${(props) => props.theme.colors.font.primary};
	}
`;
