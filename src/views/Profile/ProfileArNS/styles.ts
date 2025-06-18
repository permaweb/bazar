import styled from 'styled-components';

export const Wrapper = styled.div`
	width: 100%;
	display: flex;
	flex-wrap: wrap;
	gap: 24px;
	margin-top: 20px;
`;

export const AntCard = styled.div`
	width: 100%;
	max-width: 300px;
	padding: 16px;
	border-radius: 8px;
	background: ${(props) => props.theme.colors.container.alt2.background};
	border: 1px solid ${(props) => props.theme.colors.border.primary};
	display: flex;
	flex-direction: column;
	gap: 8px;
`;

export const AntName = styled.h3`
	margin: 0;
	font-size: 18px;
	color: ${(props) => props.theme.colors.text.primary};
`;

export const AntTicker = styled.span`
	font-size: 14px;
	color: ${(props) => props.theme.colors.text.secondary};
`;

export const AntDescription = styled.p`
	margin: 0;
	font-size: 14px;
	color: ${(props) => props.theme.colors.text.secondary};
	line-height: 1.4;
`;
