import styled from 'styled-components';

import { STYLING } from 'helpers/config';

const ACCENT_COLOR = '#5AF650';

export const Wrapper = styled.div`
	min-height: calc(100vh - (${STYLING.dimensions.nav.height} + 20px));
	width: 100%;
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 40px 20px;
	position: relative;
	overflow: hidden;
	background: #212121 !important;
	background: linear-gradient(
		180deg,
		rgb(37 37 37),
		rgb(26 26 26),
		rgb(9 9 9),
		rgb(16 16 16),
		rgb(28 28 28),
		rgb(31 31 31)
	) !important;
`;

export const Header = styled.div`
	display: flex;
	flex-direction: column;
	align-items: center;
	position: relative;
	z-index: 1;
`;

export const HeaderMain = styled.div`
	display: flex;
	flex-direction: column;
	gap: 10px;

	h1 {
		color: ${(props) => props.theme.colors.font.light1};
		text-shadow: 0 0 5px ${ACCENT_COLOR};
	}

	h1 {
		color: #ffffff;
		font-weight: 900;
		text-transform: uppercase;
		font-size: 3rem;
		text-align: center;

		text-shadow: -1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff, -2px -2px 0 gray, 2px -2px 0 gray,
			-2px 2px 0 gray, 2px 2px 0 gray, 0 0 5px #5af650, 0 0 10px #5af650, 0 0 15px #5af650, 0 0 20px #5af650;
	}
`;

export const ViewAction = styled.div`
	margin: 35px 0 0 0;
	position: relative;
	z-index: 1;
	button {
		background: rgba(15, 15, 15, 1);
		padding: 10px 20px;
		border: 2px solid ${ACCENT_COLOR};
		border-radius: ${STYLING.dimensions.radius.alt2};
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 15px;
		transition: all 100ms;

		span {
			color: ${ACCENT_COLOR};
			font-weight: ${(props) => props.theme.typography.weight.bold};
			font-size: ${(props) => props.theme.typography.size.lg};
			font-family: ${(props) => props.theme.typography.family.alt1};
		}

		&:hover {
			cursor: pointer;
			background: rgba(30, 30, 30, 1);
		}

		&:disabled {
			cursor: default;
			background: rgba(20, 20, 20, 1);
			border: 1px solid #595959;
			box-shadow: none;
			span {
				color: #595959;
			}
		}
	}
`;

export const SyncAction = styled(ViewAction)`
	margin: 30px 0 0 0;

	button {
		background: rgba(10, 10, 10, 0.65);
		padding: 10px 20px;
		border: 1px solid ${ACCENT_COLOR};
		box-shadow: none;
		border-radius: ${STYLING.dimensions.radius.alt2};
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 15px;
		pointer-events: auto;
		transition: all 100ms;

		span {
			color: ${ACCENT_COLOR};
			font-weight: ${(props) => props.theme.typography.weight.bold};
			font-size: ${(props) => props.theme.typography.size.lg};
			font-family: ${(props) => props.theme.typography.family.alt1};
		}

		&:hover {
			cursor: pointer;
			background: rgba(30, 30, 30, 0.65);
		}

		&:disabled {
			cursor: default;
			pointer-events: none;
		}
	}
`;

export const Subheader = styled.div`
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 30px;
	margin: 20px 0 0 0;

	p {
		line-height: 1.5;
		max-width: 800px;
		color: ${(props) => props.theme.colors.font.light1};
		font-size: ${(props) => props.theme.typography.size.lg};
		font-weight: ${(props) => props.theme.typography.weight.medium};
		font-family: ${(props) => props.theme.typography.family.alt1};
		text-align: center;
	}

	a {
		text-decoration: underline;
	}
`;

export const ProfileWrapper = styled.div<{ active: boolean }>`
	max-width: 90%;
	background: rgba(10, 10, 10, 0.65);
	padding: 10px 20px;
	border: 1px solid ${ACCENT_COLOR};
	border-radius: ${STYLING.dimensions.radius.alt2};
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 15px;
	pointer-events: ${(props) => (props.active ? 'none' : 'auto')};
	transition: all 100ms;

	span {
		color: ${ACCENT_COLOR};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		font-size: ${(props) => props.theme.typography.size.lg};
		font-family: ${(props) => props.theme.typography.family.alt1};
		text-align: center;
	}

	&:hover {
		cursor: ${(props) => (props.active ? 'default' : 'pointer')};
		background: ${(props) => (props.active ? 'rgba(10, 10, 10, 0.65)' : 'rgba(30, 30, 30, 0.65)')};
	}
`;

export const ProfileIndicator = styled.div<{ active: boolean }>`
	width: 17.5px;
	height: 17.5px;
	background: ${(props) => (props.active ? ACCENT_COLOR : props.theme.colors.warning.primary)};
	border-radius: 50%;
`;

export const Body = styled.div`
	width: 100%;
	display: flex;
	gap: 70px;
	margin: 60px 0 0 0;
	flex-wrap: wrap;
	justify-content: center;
	align-items: center;
	position: relative;
	z-index: 1;
`;

export const GridElement = styled.div<{ claimable: boolean; claimed: boolean }>`
	width: 100%;
	max-width: 500px;
	position: relative;
	border-radius: 12.5px;

	a {
		width: 100%;
		display: block;
		position: relative;
		border-radius: 8.5px;
		pointer-events: ${(props) => (props.claimed ? 'all' : 'none')};
		&:hover {
			img {
				border: 1.5px solid ${ACCENT_COLOR};
				box-shadow: 0px 0px 5px 3.5px ${ACCENT_COLOR};
			}
		}
	}

	img,
	video {
		width: 100%;
		border: 1.5px solid ${(props) => (props.claimable ? ACCENT_COLOR : '#FFFFFF')};
		box-shadow: ${(props) =>
			props.claimable
				? `0px 0px 10px 5.5px ${ACCENT_COLOR}`
				: props.claimed
				? '0 0 5px 3.5px #FFFFFF'
				: '0 0 5px 3.5px #FFFFFF'};
		border-radius: 10px;
		transition: all 100ms;
	}
`;

export const GridElementOverlay = styled.div`
	height: calc(100% - 6.5px);
	width: 100%;
	display: flex;
	justify-content: center;
	align-items: center;
	position: absolute;
	display: flex;
	background: rgba(10, 10, 10, 0.75);
	backdrop-filter: blur(7.5px);
	border-radius: 8.5px;

	svg {
		height: 185px;
		width: 185px;
		margin: -10px 0 0 0;
		color: #d7d7d2;
		fill: #d7d7d2;
	}
`;

export const GridElementAction = styled.button`
	width: calc(100% - 40px);
	padding: 10px 20px;
	border-radius: ${STYLING.dimensions.radius.primary};
	background: #5af650;
	border: 1.5px solid #5af650;
	box-shadow: 0 0 10px 2.5px #5af650;
	transition: all 175ms;
	pointer-events: all !important;
	span {
		color: #272727;
		font-weight: ${(props) => props.theme.typography.weight.xBold};
		font-size: ${(props) => props.theme.typography.size.xLg};
		font-family: ${(props) => props.theme.typography.family.alt1};
	}

	&:hover {
		background: rgba(10, 10, 10, 0.65);
		border: 1.5px solid #5af650;
		box-shadow: none;
		span {
			color: #5af650;
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

export const GridElementInfoWrapper = styled.div`
	width: 100%;
	margin: 20px 0 0 0;

	a {
		font-weight: ${(props) => props.theme.typography.weight.bold};
		font-size: ${(props) => props.theme.typography.size.base};
		font-family: ${(props) => props.theme.typography.family.alt1};
		background: rgba(10, 10, 10, 0.65);
		color: ${ACCENT_COLOR};
		text-decoration: underline;
		text-decoration-thickness: 1.5px;
		pointer-events: all !important;
		border: 1.5px solid ${ACCENT_COLOR};
		padding: 15px;
		border-radius: 10px;
		min-height: 85px;
		display: flex;
		justify-content: center;
		align-items: center;
		text-align: center;

		&:hover {
			background: rgba(30, 30, 30, 0.65);
		}
	}
`;

export const PrimaryAssetWrapper = styled.div`
	width: 100%;
	display: flex;
	flex-direction: column;
	gap: 30px;
	align-items: center;
	justify-content: center;
`;

export const PrimaryAsset = styled(GridElement)``;

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
		margin: -10px 0 0 0;
	}
`;

export const PrimaryAssetAction = styled(GridElementAction)`
	width: calc(100% - 40px);
`;

export const AssetTextWrapper = styled.div`
	max-width: 100%;
	display: flex;
	flex-direction: column;
	justify-content: center;
	align-items: center;
	border: 1.5px solid ${ACCENT_COLOR};
	background: rgb(10, 10, 10, 0.65);
	padding: 10px 40px;
	border-radius: ${STYLING.dimensions.radius.alt2};
	p {
		color: ${ACCENT_COLOR};
		font-size: 32px;
		font-weight: 900;
		font-family: ${(props) => props.theme.typography.family.alt1};
		text-align: center;
	}

	span {
		color: ${ACCENT_COLOR};
		font-size: ${(props) => props.theme.typography.size.lg};
		font-weight: 900;
		font-family: ${(props) => props.theme.typography.family.alt1};
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
		color: #d3d3d3;
		text-shadow: 0px 0px 20px #d3d3d3;
		font-weight: ${(props) => props.theme.typography.weight.medium};
		font-size: ${(props) => props.theme.typography.size.xLg};
		font-family: ${(props) => props.theme.typography.family.alt1};
	}

	img {
		height: 250px;
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
	overflow: hidden;
	padding: 80px 20px 20px 20px;
	background: linear-gradient(
		180deg,
		rgb(37 37 37),
		rgb(26 26 26),
		rgb(9 9 9),
		rgb(16 16 16),
		rgb(28 28 28),
		rgb(31 31 31)
	);
	border: 1.5px solid #1fd014;
	border-radius: ${STYLING.dimensions.radius.primary};
	img,
	video {
		width: 100%;
		border: 1.5px solid #1fd014;
		box-shadow: 0px 0px 10px 3.5px #5af650;
		border-radius: 12.5px;
	}
`;

export const MContentWrapper = styled.div`
	width: 100%;
	display: flex;
	flex-direction: column;
	gap: 30px;
	justify-content: center;
	align-items: center;
	position: relative;
	z-index: 1;
`;

export const MActionWrapper = styled.div`
	position: absolute;
	top: 20px;
	right: 20px;
	button {
		font-size: ${(props) => props.theme.typography.size.xSmall};
		font-weight: ${(props) => props.theme.typography.weight.xBold};
		font-family: ${(props) => props.theme.typography.family.alt1};
		background: transparent;
		border: 1px solid #c0c0c0;
		color: #c0c0c0;
		padding: 5px 10px;
		border-radius: ${STYLING.dimensions.radius.alt2};
		transition: all 175ms;
		&:hover {
			cursor: pointer;
			color: #fff;
			border: 1px solid #fff;
		}
	}
`;

export const AudioWrapper = styled.div`
	position: absolute;
	top: 15px;
	right: 15px;
	z-index: 1;
	button {
		height: 30px;
		width: 30px;
		font-size: ${(props) => props.theme.typography.size.xSmall};
		font-weight: ${(props) => props.theme.typography.weight.xBold};
		font-family: ${(props) => props.theme.typography.family.alt1};
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
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	margin: 60px 0 0 0;
	position: relative;
	z-index: 1;

	p {
		line-height: 1.55;
		max-width: 800px;
		color: ${(props) => props.theme.colors.font.light2};
		font-size: ${(props) => props.theme.typography.size.base};
		font-weight: ${(props) => props.theme.typography.weight.medium};
		font-family: ${(props) => props.theme.typography.family.alt1};
		text-align: left;
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

export const ClaimsWrapper = styled(AssetTextWrapper)`
	margin: 50px 0 0 0;
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
