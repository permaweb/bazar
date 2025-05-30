import styled from 'styled-components';

import { STYLING } from 'helpers/config';

export const Card = styled.div`
	background: ${(props) => props.theme.colors.container.primary.background};
	border: 1px solid ${(props) => props.theme.colors.border.alt4};
	border-radius: ${STYLING.dimensions.radius.primary};
	overflow: hidden;
`;

export const CardContent = styled.div`
	padding: 20px;
`;

export const Container = styled.div`
	display: flex;
	flex-direction: column;
	gap: 15px;
`;

export const Row = styled.div`
	display: flex;
	align-items: center;
	gap: 15px;
`;

export const Logo = styled.img`
	width: 50px;
	height: 50px;
	border-radius: ${STYLING.dimensions.radius.primary};
`;

export const Name = styled.h3`
	font-size: ${(props) => props.theme.typography.size.medium};
	font-weight: ${(props) => props.theme.typography.weight.bold};
	color: ${(props) => props.theme.colors.font.primary};
`;

export const Ticker = styled.p`
	font-size: ${(props) => props.theme.typography.size.small};
	color: ${(props) => props.theme.colors.font.secondary};
`;

export const Owner = styled.p`
	font-size: ${(props) => props.theme.typography.size.small};
	color: ${(props) => props.theme.colors.font.secondary};
`;

export const Description = styled.p`
	font-size: ${(props) => props.theme.typography.size.small};
	color: ${(props) => props.theme.colors.font.secondary};
`;

export const KeywordList = styled.div`
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
`;

export const Badge = styled.span`
	background: ${(props) => props.theme.colors.container.alt3.background};
	color: ${(props) => props.theme.colors.font.secondary};
	padding: 4px 8px;
	border-radius: ${STYLING.dimensions.radius.primary};
	font-size: ${(props) => props.theme.typography.size.xSmall};
`;

export const LogoPlaceholder = styled.div`
	width: 50px;
	height: 50px;
	display: flex;
	align-items: center;
	justify-content: center;
	background: ${(props) => props.theme.colors.container.alt3.background};
	border-radius: ${STYLING.dimensions.radius.primary};
	color: ${(props) => props.theme.colors.font.secondary};
	font-size: ${(props) => props.theme.typography.size.xSmall};
`;

export const TransferButton = styled.button`
	margin-top: 10px;
	padding: 8px 16px;
	background: ${(props) => props.theme.colors.button.primary.background};
	color: ${(props) => props.theme.colors.button.primary.color};
	border: none;
	border-radius: ${STYLING.dimensions.radius.primary};
	font-size: ${(props) => props.theme.typography.size.small};
	font-weight: ${(props) => props.theme.typography.weight.bold};
	cursor: pointer;
	transition: background 0.2s;
	&:disabled {
		background: ${(props) => props.theme.colors.button.primary.disabled};
		cursor: not-allowed;
	}
`;

export const ErrorMsg = styled.div`
	color: ${(props) => props.theme.colors.status.error};
	margin-top: 8px;
	font-size: ${(props) => props.theme.typography.size.xSmall};
`;
