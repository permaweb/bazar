import styled from 'styled-components';

import { STYLING } from 'helpers/config';

export const Wrapper = styled.div`
	min-height: calc(100vh - (${STYLING.dimensions.nav.height} + 20px));
	width: 100%;
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 40px 20px;
	position: relative;
	background: linear-gradient(180deg, #382c6c, #070027, #22184a);
	border: 1.5px solid #252251;
	/* background-image: url('https://arweave.net/BX69ET09R9FrjOA69RokJ9pFXuWw7wlAyaLUG269a2g');
	background-size: cover;
	background-position: center; */
`;

export const Header = styled.div`
	display: flex;
	flex-direction: column;
	align-items: center;

	img {
		width: 70%;
	}
`;

export const HeaderAction = styled.div`
	margin: 40px 0 0 0;
	button {
		transition: all 175ms;
		span {
			color: #c8c8e5;
			text-shadow: 0px 0px 20px #6b6ba9;
			font-weight: ${(props) => props.theme.typography.weight.medium};
			font-size: ${(props) => props.theme.typography.size.xLg};
			font-family: 'Frank Ruhl Libre', serif;
		}

		&:hover {
			span {
				color: #d2d2d8;
			}
		}

		&:disabled {
			span {
				color: #939393;
			}
		}
	}
`;

export const Subheader = styled.div`
	max-width: 90%;
	background: rgba(10, 10, 10, 0.625);
	padding: 30px;
	border-radius: ${STYLING.dimensions.radius.primary};
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 30px;
	margin: 20px 0 0 0;

	p {
		line-height: 1.5;
		max-width: 800px;
		color: #d8d6a7;
		font-size: ${(props) => props.theme.typography.size.lg};
		font-weight: ${(props) => props.theme.typography.weight.medium};
		font-family: 'Frank Ruhl Libre', serif;
		text-align: center;
	}
`;

export const ProfileWrapper = styled.div<{ completed: boolean }>`
	max-width: 90%;
	background: rgba(10, 10, 10, 0.65);
	padding: 10px 20px;
	border: 1px solid #7ec9bf;
	border-radius: ${STYLING.dimensions.radius.alt2};
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 15px;
	pointer-events: ${(props) => (props.completed ? 'none' : 'auto')};
	transition: all 100ms;

	span {
		color: #7ec9bf;
		font-weight: ${(props) => props.theme.typography.weight.bold};
		font-size: ${(props) => props.theme.typography.size.xLg};
		font-family: 'Frank Ruhl Libre', serif;
	}

	&:hover {
		cursor: ${(props) => (props.completed ? 'default' : 'pointer')};
		background: ${(props) => (props.completed ? 'rgba(10, 10, 10, 0.65)' : 'rgba(30, 30, 30, 0.65)')};
	}
`;

export const ProfileIndicator = styled.div<{ completed: boolean }>`
	width: 17.5px;
	height: 17.5px;
	background: ${(props) =>
		props.completed ? props.theme.colors.indicator.primary : props.theme.colors.warning.primary};
	background: ${(props) => (props.completed ? '#5AF650' : props.theme.colors.warning.primary)};
	border-radius: 50%;
`;

export const Body = styled.div`
	width: 100%;
	display: flex;
	gap: 40px;
	padding: 0 30px;
	margin: 40px 0 0 0;
	flex-wrap: wrap;
	justify-content: center;
	align-items: center;
`;

export const GridElement = styled.div<{ claimable: boolean }>`
	position: relative;

	img {
		height: 500px;
		border: 1.5px solid ${(props) => (props.claimable ? '#1fd014' : '#252251')};
		box-shadow: ${(props) => (props.claimable ? '0px 0px 15px 3.5px #5AF650' : '0 0 10px 3px #232323')};
		border-radius: 12.5px;
	}
`;

export const GridElementOverlay = styled.div`
	height: 390.5px;
	width: calc(100% - 24.5px);
	display: flex;
	justify-content: center;
	align-items: center;
	position: absolute;
	top: 12.5px;
	left: 12.5px;
	display: flex;
	background: rgba(10, 10, 10, 0.75);
	backdrop-filter: blur(7.5px);

	svg {
		height: 185px;
		width: 185px;
		margin: -50px 0 0 0;
		color: #d7d7d2;
		fill: #d7d7d2;
	}
`;

export const GridElementLink = styled.a`
	height: 77.5px;
	width: 276.5px;
	position: absolute;
	bottom: 20.5px;
	left: 14.5px;
	background: transparent;
	border: 1px solid #7ec9bf;
	border-radius: 5px;
	box-shadow: 0 0 5px #47ff00;

	&:hover {
		box-shadow: 0 0 10px #47ff00;
	}
`;

export const GridElementAction = styled.button`
	width: calc(100% - 20px);
	background: ${(props) => props.theme.colors.indicator.primary};
	padding: 10px 20px;
	border-radius: ${STYLING.dimensions.radius.primary};
	background: linear-gradient(180deg, #80f154, #bbe948, #efe13e);
	border: 1.5px solid #80f154;
	box-shadow: 0 0 10px 2.5px #80f154;
	transition: all 175ms;
	span {
		color: #0d3f0a;
		font-weight: ${(props) => props.theme.typography.weight.xBold};
		font-size: ${(props) => props.theme.typography.size.xLg};
		font-family: 'Frank Ruhl Libre', serif;
	}

	&:hover {
		background: rgba(10, 10, 10, 0.65);
		border: 1.5px solid #7ec9bf;
		box-shadow: none;
		span {
			color: #7ec9bf;
		}
	}

	&:disabled {
		background: #666666;
		box-shadow: none;
		border: 1.5px solid #666666;
		span {
			color: ${(props) => props.theme.colors.font.light1};
		}
	}
`;

export const PrimaryAssetWrapper = styled.div`
	display: flex;
	flex-direction: column;
	gap: 30px;
	align-items: center;
	justify-content: center;
`;

export const PrimaryAsset = styled(GridElement)`
	border-radius: 0;
	box-shadow: none;
	img {
		height: 550px;
		border: 1.5px solid ${(props) => (props.claimable ? '#1fd014' : '#252251')};
		box-shadow: ${(props) => (props.claimable ? '0px 0px 10px 5.5px #5AF650' : '0 0 10px 3px #232323')};
		border-radius: 0;
	}
`;

export const PrimaryAssetOverlay = styled(GridElementOverlay)`
	height: 550px;
	width: 100%;
	display: flex;
	justify-content: center;
	align-items: center;
	position: absolute;
	top: 0;
	left: 0;
	display: flex;
	background: rgba(15, 15, 15, 0.55);
	backdrop-filter: blur(2.5px);
	border: 1px solid #585858;
	border-radius: 0;

	svg {
		height: 250px;
		width: 250px;
		margin: 0;
	}
`;

export const PrimaryAssetAction = styled(GridElementAction)`
	width: calc(100% - 40px);
`;

export const AssetTextWrapper = styled.div`
	display: flex;
	flex-direction: column;
	justify-content: center;
	align-items: center;
	background: #f5b700;
	background-image: radial-gradient(circle, rgba(0, 0, 0, 0.15) 1px, transparent 1px);
	background-size: 3px 3px;
	padding: 7.5px 40px 10px 40px;
	border-radius: ${STYLING.dimensions.radius.alt2};
	p {
		color: #3e0600;
		font-size: 32px;
		font-weight: 900;
		font-family: 'Frank Ruhl Libre', serif;
		text-align: center;
	}

	span {
		color: #54221d;
		font-size: ${(props) => props.theme.typography.size.lg};
		font-weight: 900;
		font-family: 'Frank Ruhl Libre', serif;
		text-align: center;
	}
`;

export const BodyLoading = styled.div`
	width: 100%;
	display: flex;
	justify-content: center;
	align-items: center;
	margin: 20px 0 0 0;

	span {
		color: #c8c8e5;
		text-shadow: 0px 0px 20px #6b6ba9;
		font-weight: ${(props) => props.theme.typography.weight.medium};
		font-size: ${(props) => props.theme.typography.size.xLg};
		font-family: 'Frank Ruhl Libre', serif;
	}
`;

export const PManageWrapper = styled.div`
	max-width: 550px;
`;

export const MWrapper = styled.div<{ primaryAsset: boolean }>`
	width: 100%;
	display: flex;
	flex-direction: column;
	justify-content: center;
	align-items: center;
	position: relative;
	padding: 60px 20px 40px 20px;
	background: linear-gradient(180deg, #382c6c, #070027, #22184a);
	border: 1.5px solid #252251;
	border-radius: ${STYLING.dimensions.radius.primary};
	img {
		height: 425px;
		margin: 40px 0;
		border: 1.5px solid #1fd014;
		box-shadow: 0px 0px 15px 3.5px #5af650;
		border-radius: ${(props) => (props.primaryAsset ? '0' : '12.5px')};
	}
`;

export const MDescription = styled.div`
	padding: 0 20px;
	p {
		line-height: 1.5;
		color: #f5b700;
		font-size: ${(props) => props.theme.typography.size.small};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		font-family: 'Frank Ruhl Libre', serif;
		text-align: center;
	}
`;

export const MActionWrapper = styled.div`
	position: absolute;
	top: 20px;
	right: 20px;
	button {
		font-size: ${(props) => props.theme.typography.size.xSmall};
		font-weight: ${(props) => props.theme.typography.weight.xBold};
		font-family: 'Frank Ruhl Libre', serif;
		background: transparent;
		border: 1px solid #c0c0c0;
		color: #c0c0c0;
		padding: 5px 10px;
		border-radius: ${STYLING.dimensions.radius.alt2};
		transition: all 175ms;
		&:hover {
			color: #fff;
			border: 1px solid #fff;
		}
	}
`;

export const AudioWrapper = styled.div`
	position: absolute;
	top: 15px;
	right: 15px;
	button {
		height: 30px;
		width: 30px;
		font-size: ${(props) => props.theme.typography.size.xSmall};
		font-weight: ${(props) => props.theme.typography.weight.xBold};
		font-family: 'Frank Ruhl Libre', serif;
		background: transparent;
		border: 1px solid #c0c0c0;
		color: #c0c0c0;
		border-radius: 50%;
		transition: all 175ms;

		svg {
			height: 12.5px;
			width: 12.5px;
			margin: 4.5px 0 0 0;
			color: #c0c0c0;
			fill: #c0c0c0;
		}

		&:hover {
			color: #fff;
			border: 1px solid #fff;
			svg {
				color: #fff;
				fill: #fff;
			}
		}
	}
`;

export const Footer = styled.div`
	width: fit-content;
	max-width: 90%;
	background: rgba(10, 10, 10, 0.625);
	padding: 12.5px 25px;
	border-radius: ${STYLING.dimensions.radius.primary};
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 30px;
	margin: 40px 0 0 0;

	p {
		line-height: 1.5;
		max-width: 800px;
		color: #d8d6a7;
		font-size: ${(props) => props.theme.typography.size.base};
		font-weight: ${(props) => props.theme.typography.weight.medium};
		font-family: 'Frank Ruhl Libre', serif;
		text-align: center;
	}
`;

export const BlockWrapper = styled.div`
	max-width: 90%;
	display: flex;
	flex-direction: column;
	justify-content: center;
	align-items: center;
	gap: 20px;
	margin: 40px auto;

	a {
		padding: 5px 10px;
		font-size: ${(props) => props.theme.typography.size.xSmall};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		background: transparent;
		border: 1px solid #000;
		color: #000;
		border-radius: 5px;
		transition: all 175ms;

		&:hover {
			color: #444;
			border: 1px solid #444;
		}
	}
`;

export const BlockMessage = styled.div`
	p {
		color: ${(props) => props.theme.colors.font.primary};
		font-size: ${(props) => props.theme.typography.size.base};
		font-weight: ${(props) => props.theme.typography.weight.regular};
		font-family: ${(props) => props.theme.typography.family.primary};
		text-transform: uppercase;
		text-align: center;
		line-height: 1.65;
	}
`;
