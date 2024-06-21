import styled from 'styled-components';

import { fadeIn1, open } from 'helpers/animations';

export const Wrapper = styled.div`
	height: 30px;
	width: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 20px;
	border-bottom: 1px solid ${(props) => props.theme.colors.border.alt2};
	background: ${(props) => props.theme.colors.container.alt6.background};
	animation: ${open} ${fadeIn1};
	button {
		width: fit-content;
		color: ${(props) => props.theme.colors.font.light1};
		font-size: ${(props) => props.theme.typography.size.xxSmall};
		font-family: ${(props) => props.theme.typography.family.alt1};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		text-transform: uppercase;
		text-decoration: underline;
		text-decoration-thickness: 1.5px;
		&:hover {
			color: ${(props) => props.theme.colors.font.light2};
		}
	}
`;

export const MWrapper = styled.div`
	p {
		font-size: ${(props) => props.theme.typography.size.base};
		font-family: ${(props) => props.theme.typography.family.primary};
		font-weight: ${(props) => props.theme.typography.weight.medium};
		color: ${(props) => props.theme.colors.font.alt1};
		margin: 0 0 10px 0;
		b {
			font-weight: ${(props) => props.theme.typography.weight.xBold};
			color: ${(props) => props.theme.colors.font.primary};
		}
	}
`;

export const TransferAmount = styled.div`
	width: 100%;
	margin: 20px auto;
	padding: 20px 0;
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	justify-content: center;
	gap: 10px;
	border-top: 1px solid ${(props) => props.theme.colors.border.primary};
	border-bottom: 1px solid ${(props) => props.theme.colors.border.primary};
	span {
		font-size: ${(props) => props.theme.typography.size.xLg} !important;
		font-family: ${(props) => props.theme.typography.family.alt1};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		color: ${(props) => props.theme.colors.font.primary};
	}
	img {
		height: 22.5px;
		width: 22.5px;
	}
`;

export const ActionsWrapper = styled.div`
	width: 100%;
	display: flex;
	align-items: center;
	justify-content: space-between;
	flex-wrap: wrap;
	gap: 20px;
	margin: 30px auto 10px auto;
	button {
		width: calc(50% - 10px) !important;
		span {
			font-size: clamp(18px, 1vw, 24px) !important;
			font-family: ${(props) => props.theme.typography.family.alt1};
			text-transform: uppercase;
			white-space: nowrap;
		}
	}
`;
