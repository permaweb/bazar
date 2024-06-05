import styled from 'styled-components';

export const Wrapper = styled.footer`
	height: 50px;
	width: 100%;
	position: relative;
	background: ${(props) => props.theme.colors.view.background};
`;

export const Container = styled.div`
	width: 100%;
	height: 50px;
	display: flex;
	justify-content: space-between;
	align-items: center;
	bottom: 0;
`;

export const Content = styled.p`
	color: ${(props) => props.theme.colors.font.primary};
	font-family: ${(props) => props.theme.typography.family.primary};
	font-size: ${(props) => props.theme.typography.size.xSmall};
	font-weight: ${(props) => props.theme.typography.weight.bold};
`;

export const EWrapper = styled.div`
	display: flex;
	align-items: center;
	> * {
		&:not(:last-child) {
			margin: 0 20px 0 0;
		}
		&:last-child {
			margin: 0;
		}
	}
	a,
	button {
		font-family: ${(props) => props.theme.typography.family.primary};
		font-size: ${(props) => props.theme.typography.size.xSmall};
		font-weight: ${(props) => props.theme.typography.weight.medium};
		text-decoration: none !important;
		&:hover {
			color: ${(props) => props.theme.colors.font.primary.alt8};
		}
	}
	svg {
		height: 17.5px;
		width: 17.5px;
		fill: ${(props) => props.theme.colors.icon.alt2.fill};
		&:hover {
			fill: ${(props) => props.theme.colors.icon.alt2.active};
		}
	}
`;
