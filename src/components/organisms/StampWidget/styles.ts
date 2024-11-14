import styled from 'styled-components';

import { STYLING } from 'helpers/config';

export const Wrapper = styled.button<{ sm: boolean }>`
	height: ${(props) => (props.sm ? 'fit-content' : '37.5px')};
	width: fit-content !important;
	background: ${(props) =>
		props.sm ? props.theme.colors.transparent : props.theme.colors.container.primary.background};
	padding: ${(props) => (props.sm ? '2.5px 6.5px' : '6.5px 10px')};
	display: flex;
	align-items: center;
	cursor: pointer;
	&:hover {
		background: ${(props) => props.theme.colors.container.primary.hover};
		cursor: pointer;
	}
	&:disabled {
		background: ${(props) => props.theme.colors.button.primary.disabled.background};
		cursor: default;
	}
	p {
		margin: ${(props) => (props.sm ? '0 7.5px 0 0' : '0 12.5px 0 0')};
		color: ${(props) => props.theme.colors.font.primary};
		font-family: ${(props) => props.theme.typography.family.alt1};
		font-size: ${(props) => props.theme.typography.size.base};
		font-weight: ${(props) => props.theme.typography.weight.bold};
	}
	svg {
		transition: all 300ms;
		margin: 3.5px 0 0 0;
		height: ${(props) => (props.sm ? '15px' : '21.5px')} !important;
		width: ${(props) => (props.sm ? '15px' : '23.5px')} !important;
	}
`;

export const DetailLine = styled.div`
	display: flex;
	align-items: center;
	margin: 0 0 10px 0;
	span {
		font-size: ${(props) => props.theme.typography.size.small};
		line-height: calc(${(props) => props.theme.typography.size.small} + 5px);
		font-family: ${(props) => props.theme.typography.family.primary};
		letter-spacing: 0.1rem;
		color: ${(props) => props.theme.colors.font.primary.alt1};
	}
	p {
		margin: 0 0 0 5px;
		font-size: ${(props) => props.theme.typography.size.small};
		line-height: calc(${(props) => props.theme.typography.size.small} + 5px);
		font-family: ${(props) => props.theme.typography.family.primary};
		color: ${(props) => props.theme.colors.font.primary.alt1};
	}
`;

export const DetailLineInfo = styled(DetailLine)`
	margin: 0 0 20px 0;
	p {
		font-weight: ${(props) => props.theme.typography.weight.bold};
		line-height: 1.5;
	}
`;

export const FlexActions = styled.div`
	display: flex;
	align-items: center;
	margin: 20px 0 0 0;
	flex-wrap: wrap;
	gap: 20px;
	button {
		margin: 0 20px 0 0;
	}
`;

export const SAContainer = styled.div`
	min-height: 100px;
	margin: 20px 0 0 0;
	width: 100%;
	max-width: 55vw;
	display: flex;
	flex-direction: column;
	@media (max-width: ${STYLING.cutoffs.initial}) {
		max-width: none;
	}
`;

export const SAInfoContainer = styled.div`
	height: 30px;
	width: 100%;
	display: flex;
	justify-content: space-between;
	align-items: center;
`;

export const SABalanceContainer = styled.div`
	display: flex;
	align-items: center;
	padding: 7.5px 12.5px !important;
	border: 1px solid ${(props) => props.theme.colors.border.primary};
	border-radius: ${STYLING.dimensions.borderRadiusWrapper};
	svg {
		fill: ${(props) => props.theme.colors.font.primary.alt1} !important;
		width: 12.5px !important;
		margin: 2.5px 10px 0 0 !important;
	}
	p {
		max-width: 85%;
		font-family: ${(props) => props.theme.typography.family.primary} !important;
		font-size: ${(props) => props.theme.typography.size.xSmall} !important;
		font-weight: ${(props) => props.theme.typography.weight.medium} !important;
		color: ${(props) => props.theme.colors.font.primary.alt1} !important;
		overflow: hidden;
		text-overflow: ellipsis;
		height: auto !important;
		margin: 0 !important;
	}
`;

export const SACloseContainer = styled.div``;

export const SAFormContainer = styled.form`
	height: calc(100% - 30px);
	width: 100%;
`;

export const SAInput = styled.div`
	width: 350px;
	max-width: 100%;
`;

export const SAActions = styled.div`
	width: 100%;
	display: flex;
	justify-content: flex-end;
	align-items: center;
	> * {
		&:not(:last-child) {
			margin: 0 20px 0 0 !important;
		}
		&:last-child {
			margin: 0 !important;
		}
	}
`;

export const Message = styled.div<{ loading: 'true' | 'false' }>`
	margin: 20px 0 0 auto;
	p {
		font-size: ${(props) => props.theme.typography.size.xSmall};
		line-height: calc(${(props) => props.theme.typography.size.xSmall} + 10px);
		font-family: ${(props) => props.theme.typography.family.primary};
		font-weight: ${(props) => props.theme.typography.weight.medium};
		color: ${(props) => props.theme.colors.font.primary.alt1};
	}
`;

export const WalletBlock = styled.div`
	margin: 30px 0 0 0;
	p {
		margin: 0 0 20px 0;
	}
`;
