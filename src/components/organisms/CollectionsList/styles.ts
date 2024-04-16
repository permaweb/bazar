import styled from 'styled-components';

import { STYLING } from 'helpers/config';

export const Wrapper = styled.div``;

export const CollectionsWrapper = styled.div`
	> * {
		&:not(:last-child) {
			margin: 0 0 15px 0;
		}
		&:last-child {
			margin: 0;
		}
	}
`;

export const Header = styled.div`
	margin: 0 0 20px 0;
`;

export const ListHeader = styled.div`
	padding: 0 20px 7.5px 20px;
	margin: 0 0 20px 0;
	display: flex;
	align-items: center;
	justify-content: space-between;
	border-bottom: 1px solid ${(props) => props.theme.colors.border.primary};
	span {
		color: ${(props) => props.theme.colors.font.alt1};
		font-size: ${(props) => props.theme.typography.size.small};
		font-family: ${(props) => props.theme.typography.family.primary};
		font-weight: ${(props) => props.theme.typography.weight.bold};
	}
`;

export const CollectionWrapper = styled.div`
	height: 120px;
	width: 100%;
	overflow: hidden;
	a {
		height: 100%;
		width: 100%;
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 10px 20px;
		&:hover {
			background: ${(props) => props.theme.colors.container.primary.active};
		}
	}
`;

export const FlexElement = styled.div`
	display: flex;
	align-items: center;
`;

export const Index = styled.div`
	margin: 0 20px 0 0;
	span {
		font-size: ${(props) => props.theme.typography.size.base};
		font-family: ${(props) => props.theme.typography.family.alt1};
		font-weight: ${(props) => props.theme.typography.weight.bold};
	}
`;

export const Thumbnail = styled.div`
	height: 85px;
	width: 85px;
	background: ${(props) => props.theme.colors.container.primary.background};
	border-radius: ${STYLING.dimensions.radius.alt2};
	margin: 0 20px 0 0;
	overflow: hidden;
	position: relative;
	img {
		height: 100%;
		width: 100%;
		object-fit: cover;
	}
`;

export const Title = styled.div`
	span {
		font-size: ${(props) => props.theme.typography.size.base};
		font-family: ${(props) => props.theme.typography.family.primary};
		font-weight: ${(props) => props.theme.typography.weight.xBold};
	}
`;

export const DateCreated = styled.div`
	span {
		color: ${(props) => props.theme.colors.font.alt1};
		font-size: ${(props) => props.theme.typography.size.base};
		font-family: ${(props) => props.theme.typography.family.primary};
		font-weight: ${(props) => props.theme.typography.weight.bold};
	}
`;

export const UpdateWrapper = styled.div`
	width: fit-content;
	margin: 40px auto 0 auto !important;
	button {
		span {
			font-size: ${(props) => props.theme.typography.size.xLg} !important;
			font-family: ${(props) => props.theme.typography.family.alt1};
			text-transform: uppercase;
		}
	}
	@media (max-width: ${STYLING.cutoffs.secondary}) {
		width: 100%;
		button {
			min-width: 0;
			width: 100%;
		}
	}
`;
