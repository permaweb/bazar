import styled from 'styled-components';

export const Wrapper = styled.div`
	margin: 0 0 40px 0;
`;

export const HeaderInfo = styled.div`
	display: flex;
	flex-wrap: wrap;
	gap: 25px;
`;

export const HeaderAvatar = styled.div`
	height: 115px;
	width: 115px;
	background: ${(props) => props.theme.colors.container.alt2.background};
	border: 1px solid ${(props) => props.theme.colors.border.primary};
	border-radius: 50%;
	display: flex;
	justify-content: center;
	align-items: center;
	svg {
		height: 65px;
		width: 65px;
		stroke: ${(props) => props.theme.colors.icon.primary.fill};
	}
	img {
		height: 100%;
		width: 100%;
		object-fit: cover;
		border-radius: 50%;
	}
`;

export const HeaderHA = styled.div`
	h4 {
		color: ${(props) => props.theme.colors.font.primary};
		font-size: clamp(24px, 3.25vw, 32px);
		font-weight: ${(props) => props.theme.typography.weight.xxBold};
		line-height: 1.5;
		overflow-wrap: anywhere;
	}
`;

export const HeaderInfoDetail = styled.div`
	margin: 2.5px 0 0 0;
	span {
		color: ${(props) => props.theme.colors.font.primary};
		font-size: ${(props) => props.theme.typography.size.small};
		font-weight: ${(props) => props.theme.typography.weight.medium};
	}
`;

export const HeaderAddress = styled.button`
	display: flex;
	align-items: center;
	margin: 7.5px 0 0 0;
	p {
		color: ${(props) => props.theme.colors.font.primary};
		font-size: ${(props) => props.theme.typography.size.small};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		margin: 0 0 0 10px;
	}
	span {
		color: ${(props) => props.theme.colors.font.primary};
		font-size: ${(props) => props.theme.typography.size.xSmall};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		display: block;
		margin: 0 0 3.5px 10px;
	}
	svg {
		width: 15px;
		fill: ${(props) => props.theme.colors.font.primary};
		margin: 2.5px 0 0 0;
	}
	&:hover {
		opacity: 0.75;
	}
`;
