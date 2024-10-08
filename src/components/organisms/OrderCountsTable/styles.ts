import styled from 'styled-components';

import { STYLING } from 'helpers/config';

export const Wrapper = styled.div`
	width: 100%;
	display: flex;
	flex-direction: column;
	gap: 60px;
`;

export const Section = styled.div`
	width: 100%;
`;

export const Header = styled.div`
	display: flex;
	justify-content: space-between;
	align-items: center;
	flex-wrap: wrap;
	gap: 20px;
	margin: 0 0 20px 0;
`;

export const HeaderActions = styled.div`
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 20px;
`;

export const ProfilesWrapper = styled.div`
	display: grid;
	grid-template-columns: repeat(5, 1fr);
	gap: 30px;
	@media (max-width: ${STYLING.cutoffs.desktop}) {
		grid-template-columns: repeat(2, 1fr);
	}
	@media (max-width: ${STYLING.cutoffs.tabletSecondary}) {
		grid-template-columns: 1fr;
	}
`;

export const ProfileWrapper = styled.div`
	height: 310px;
	width: 100%;
	a {
		min-height: 100%;
		min-width: 100%;
		height: 100%;
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		transition: all 100ms;
		padding: 20px;
		border: 1px solid transparent;
		border-radius: ${STYLING.dimensions.radius.primary};
		&:hover {
			background: ${(props) => props.theme.colors.container.primary.active};
		}
	}
`;

export const Avatar = styled.div<{
	hasOwner: boolean;
	hasImage: boolean;
}>`
	height: 150px;
	width: 150px;
	background: ${(props) =>
		props.hasOwner ? props.theme.colors.container.primary.background : props.theme.colors.container.primary.background};
	border: 1px solid ${(props) => props.theme.colors.border.alt4};
	border-radius: 50%;
	overflow: hidden;
	display: flex;
	justify-content: center;
	align-items: center;
	position: relative;
	margin: 0 0 20px 0;
	img {
		height: 100%;
		width: 100%;
		object-fit: cover;
	}
	svg {
		height: 75px;
		width: 75px;
		padding: 2.5px 0 0 0px;
		margin: 0 0 -3.5px 0;
	}
`;

export const Username = styled.div`
	width: 100%;
	margin: 0 0 10px 0;
	p {
		color: ${(props) => props.theme.colors.font.primary};
		font-size: ${(props) => props.theme.typography.size.xLg};
		font-family: ${(props) => props.theme.typography.family.alt1};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		text-align: center;
		margin: auto;
		max-width: 150px;
		white-space: nowrap;
		text-overflow: ellipsis;
		overflow-x: hidden;
	}
`;

export const Bio = styled.div`
	text-align: center;
	span {
		color: ${(props) => props.theme.colors.font.alt1};
		font-size: ${(props) => props.theme.typography.size.small};
		font-family: ${(props) => props.theme.typography.family.primary};
		font-weight: ${(props) => props.theme.typography.weight.bold};
	}
`;
