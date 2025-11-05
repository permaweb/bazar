import styled from 'styled-components';

import { STYLING } from 'helpers/config';

export const Wrapper = styled.div`
	height: 100%;
	width: 100%;
	background: ${(props) => props.theme.colors.container.primary.active};
	border: 1px solid ${(props) => props.theme.colors.border.alt4};
	border-radius: ${STYLING.dimensions.radius.primary};
	overflow: hidden;
	position: relative;
	@media (max-width: ${STYLING.cutoffs.desktop}) {
		border: none;
	}
`;

export const Header = styled.div`
	height: 60px;
	width: 100%;
	display: flex;
	align-items: end;
	padding: 0 0 0 2.5px;
`;

export const Header1 = styled.h2`
	font-size: 20px;
	font-family: ${(props) => props.theme.typography.family.primary};
	font-weight: 200;
	margin: 0;
`;

export const Frame = styled.iframe`
	height: 100%;
	width: 100%;
	scrollbar-width: none;
	-ms-overflow-style: none;

	&::-webkit-scrollbar {
		display: none;
	}
`;

export const FramePreview = styled.div`
	height: 100%;
	width: 100%;
	display: flex;
	justify-content: center;
	align-items: center;
	img,
	svg {
		height: 100px;
		width: 100px;
		border-radius: ${STYLING.dimensions.radius.primary};
	}
	img {
		border-radius: ${STYLING.dimensions.radius.primary};
	}
	background: ${(props) => props.theme.colors.container.alt1.background};
`;

export const Image = styled.img<{ contain: boolean }>`
	height: 100%;
	width: 100%;
	object-fit: ${(props) => (props.contain ? 'contain' : 'cover')};
	border-radius: ${STYLING.dimensions.radius.alt2};
	background: ${(props) => props.theme.colors.container.alt2.background};
`;

export const Logo = styled(Image)`
	height: 85%;
	width: 85%;
	background: transparent;
	position: absolute;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
	@media (max-width: ${STYLING.cutoffs.desktop}) {
		min-height: 400px;
		height: 100%;
		width: 100%;
		position: relative;
		top: 0;
		left: 0;
		transform: none;
	}
`;

export const AudioWrapper = styled.div`
	height: 100%;
	width: 100%;
	position: relative;
	svg {
		height: 75px;
		width: 75px;
		max-height: 50%;
		max-width: 50%;
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		fill: ${(props) => props.theme.colors.font.alt1};
	}
`;

export const Audio = styled.audio`
	height: 50px;
	width: calc(100% - 40px);
	position: absolute;
	bottom: 20px;
	left: 50%;
	transform: translate(-50%, 0);
`;

export const CoverArtImage = styled.img`
	width: 100%;
	height: calc(100% - 70px);
	object-fit: cover;
	border-radius: ${STYLING.dimensions.radius.primary};
`;

export const CoverArtPreview = styled.img`
	width: 100%;
	height: 100%;
	object-fit: cover;
	border-radius: ${STYLING.dimensions.radius.primary};
`;

export const CoverArtFullSection = styled.div`
	height: 100%;
	width: 100%;
	position: relative;
	overflow: hidden;
	border-radius: ${STYLING.dimensions.radius.primary};

	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		border-radius: ${STYLING.dimensions.radius.primary};
	}

	svg {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: ${(props) => props.theme.colors.font.alt1};
	}
`;

export const Video = styled.video`
	height: 100%;
	width: 100%;
	background: ${(props) => props.theme.colors.container.alt8.background};
`;

export const Preview = styled.div`
	height: 100%;
	width: 100%;
	display: flex;
	justify-content: center;
	align-items: center;
	position: relative;

	img,
	svg {
		height: 57.5px;
		width: 57.5px;
		border-radius: ${STYLING.dimensions.radius.primary};
		fill: ${(props) => props.theme.colors.font.alt1};
	}

	/* Cover art images should take full size */
	img[alt='Cover Art'] {
		height: 100%;
		width: 100%;
		object-fit: cover;
		border-radius: ${STYLING.dimensions.radius.primary};
	}
`;

export const UnsupportedWrapper = styled.div`
	height: 100%;
	width: 100%;
	display: flex;
	flex-direction: column;
	justify-content: center;
	align-items: center;
	position: relative;
	p {
		font-size: ${(props) => props.theme.typography.size.small};
		line-height: calc(${(props) => props.theme.typography.size.small} + 5px);
		font-family: ${(props) => props.theme.typography.family.primary};
		font-weight: ${(props) => props.theme.typography.weight.medium};
		color: ${(props) => props.theme.colors.font.alt1};
	}
	svg {
		height: 75px;
		width: 75px;
		max-height: 50%;
		max-width: 50%;
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		fill: ${(props) => props.theme.colors.font.alt1};
	}
`;

export const LoaderWrapper = styled.div`
	height: 100%;
	width: 100%;
	display: flex;
	justify-content: center;
	align-items: center;
	border: none;
`;
