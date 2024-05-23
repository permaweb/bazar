import styled from 'styled-components';

export const Wrapper = styled.div`
	position: relative;
	span {
		text-shadow: none !important;
	}
`;

export const Action = styled.button`
	height: 35px;
	padding: 0 15px 0 12.5px;
	display: flex;
	align-items: center;
	gap: 10px;
	img {
		height: 20px;
		width: 20px;
		padding: 0 0 1.5px 0;
	}
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
`;

export const SDHeader = styled.div`
	margin: 0 0 10px 0;
	padding: 20px 0 0 0;
	p {
		color: ${(props) => props.theme.colors.font.primary};
		font-size: ${(props) => props.theme.typography.size.lg};
		font-weight: ${(props) => props.theme.typography.weight.medium};
		line-height: 1.5;
		text-align: center;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
`;

export const SDStreak = styled.div`
	width: 100%;
	display: flex;
	justify-content: center;
	align-items: center;
	padding: 0 0 20px 0;
	margin: 10px 0;
	border-bottom: 1px solid ${(props) => props.theme.colors.border.primary};
	p {
		color: ${(props) => props.theme.colors.font.primary};
		font-size: ${(props) => props.theme.typography.size.xLg};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		font-family: ${(props) => props.theme.typography.family.alt1};
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	img {
		height: 27.5px;
		width: 27.5px;
		margin: -3.5px 10px 0 0;
	}
`;

export const SDAmounts = styled.div`
	width: 100%;
	display: flex;
	justify-content: center;
	align-items: center;
	gap: 40px;
	margin: 30px 0;
`;

export const SDAmount = styled.div`
	display: flex;
	flex-direction: column;
	align-items: center;
	p {
		color: ${(props) => props.theme.colors.font.primary};
		font-size: ${(props) => props.theme.typography.size.xLg};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		font-family: ${(props) => props.theme.typography.family.alt1};
		display: flex;
		align-items: center;
		svg {
			height: 20px;
			width: 20px;
			margin: 8.5px 0 0 10px;
		}
	}
	span {
		color: ${(props) => props.theme.colors.font.alt1};
		font-size: ${(props) => props.theme.typography.size.xxxSmall};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		text-transform: uppercase;
		display: block;
	}
`;

export const SDMessage = styled.div`
	width: 100%;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 10px;
	margin: 10px 0 20px 0;
	padding: 10px 20px 30px 20px;
	border-bottom: 1px solid ${(props) => props.theme.colors.border.primary};
`;

export const SDMessageInfo = styled.div`
	width: 100%;
	span {
		color: ${(props) => props.theme.colors.font.primary};
		font-size: ${(props) => props.theme.typography.size.base};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		font-family: ${(props) => props.theme.typography.family.primary};
		display: block;
		text-align: center;
	}
`;

export const SDMessageCount = styled.div`
	display: flex;
	align-items: center;
	padding: 10px 30px;
	margin: 10px auto;
`;

export const SDMessageCountUnit = styled.div`
	p {
		color: ${(props) => props.theme.colors.font.alt5};
		font-size: ${(props) => props.theme.typography.size.h4};
		font-weight: ${(props) => props.theme.typography.weight.xBold};
		font-family: ${(props) => props.theme.typography.family.alt1};
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-align: center;
	}
	span {
		color: ${(props) => props.theme.colors.font.primary};
		font-size: ${(props) => props.theme.typography.size.xxxSmall};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		text-transform: uppercase;
		display: block;
		margin: -2.5px 0 0 0;
	}
`;

export const SDMessageCountDivider = styled.div`
	margin: 0 30px;
	span {
		color: ${(props) => props.theme.colors.font.alt1};
		font-size: ${(props) => props.theme.typography.size.xLg};
		font-weight: ${(props) => props.theme.typography.weight.bold};
	}
`;

export const SDLAction = styled.div`
	width: 100%;
	padding: 0 20px 20px 20px;
	button {
		span {
			font-size: ${(props) => props.theme.typography.size.lg} !important;
			font-family: ${(props) => props.theme.typography.family.alt1} !important;
		}
		svg {
			height: 20px;
			width: 20px;
			margin: 2.5px 12.5px 0 0 !important;
		}
	}
`;

export const MWrapper = styled.div``;

export const MLoadingWrapper = styled.div`
	span {
		font-size: ${(props) => props.theme.typography.size.base};
		font-weight: ${(props) => props.theme.typography.weight.bold};
	}
`;

export const StreaksWrapper = styled.div`
	margin: 20px 0 0 0;
	> * {
		&:not(:last-child) {
			margin: 0 0 20px 0;
		}
		&:last-child {
			margin: 0;
		}
	}
`;

export const StreakLine = styled.div`
	display: flex;
	align-items: center;
`;

export const StreakIndex = styled.div`
	margin: 0 15px 0 0;
	span {
		font-size: ${(props) => props.theme.typography.size.base};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		font-family: ${(props) => props.theme.typography.family.alt1};
	}
`;

export const StreakProfile = styled.div`
	flex: 1;
	a {
		font-size: ${(props) => props.theme.typography.size.base};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		font-family: ${(props) => props.theme.typography.family.alt1};
	}
`;

export const StreakCount = styled.div`
	display: flex;
	align-items: center;
	gap: 10px;
	img {
		height: 20px;
		width: 20px;
		padding: 0 0 1.5px 0;
	}
	span {
		color: ${(props) => props.theme.colors.font.primary};
		font-family: ${(props) => props.theme.typography.family.alt1};
		font-size: ${(props) => props.theme.typography.size.base};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		display: block;
	}
`;
