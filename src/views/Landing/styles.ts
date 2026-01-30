import styled from 'styled-components';

import { STYLING } from 'helpers/config';

export const Wrapper = styled.div`
	width: 100%;
`;

export const FeaturedTokenWrapper = styled.div`
	margin: 0 0 40px 0;
`;

export const TokenWrapper = styled.div<{ disabled: boolean }>`
	width: 100%;
	overflow: hidden;
	margin: 20px 0 0 0;
	transition: all 100ms;

	background-image: radial-gradient(${(props) => props.theme.colors.container.alt1.background} 1px, transparent 1px);
	background-size: 3px 3px;
	background-position: 0 0;

	a {
		min-height: 450px;
		min-width: 100%;
		height: 100%;
		width: 100%;
		display: flex;
		position: relative;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		transition: all 100ms;
		padding: 20px;
		border: 1px solid transparent;

		> :first-child {
			position: absolute;
			top: -30px;
			left: 29%;
			z-index: 2;
		}
		> :last-child {
			position: absolute;
			top: 60px;
			right: 32%;
			z-index: 1;
		}
	}
	&:hover {
		background: ${(props) =>
			props.disabled
				? props.theme.colors.container.primary.active
				: props.theme.colors.container.alt1.background} !important;
		border: 1px solid
			${(props) => (props.disabled ? props.theme.colors.border.primary : props.theme.colors.border.alt2)} !important;
	}

	@media (max-width: ${STYLING.cutoffs.desktop}) {
		a {
			> :first-child {
				position: relative;
				top: auto;
				left: auto;
			}
			> :last-child {
				display: none;
			}
		}
	}
`;

export const TokenImage = styled.div<{}>`
	height: 300px;
	width: 300px;
	box-shadow: 0px 1.5px 5px 0px ${(props) => props.theme.colors.contrast.background};
	border: 1px solid ${(props) => props.theme.colors.border.primary};
	border-radius: 50%;
	overflow: hidden;
	display: flex;
	justify-content: center;
	align-items: center;
	position: relative;
	margin: 60px 0;
	img {
		height: 100%;
		width: 100%;
		object-fit: cover;
	}
`;

export const TokenName = styled.div`
	width: 100%;
	p {
		color: ${(props) => props.theme.colors.font.primary};
		font-size: ${(props) => props.theme.typography.size.h4};
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

export const CollectionsWrapper = styled.div`
	margin: 0 0 60px 0;
`;

export const MusicCollectionsWrapper = styled.div`
	margin: 0 0 60px 0;
`;

export const EbookCollectionsWrapper = styled.div`
	margin: 0 0 60px 0;
`;

export const ActivityWrapper = styled.div`
	margin: 0 0 60px 0;
`;

export const TokensWrapper = styled.div`
	margin: 0 0 60px 0;
`;

export const FeaturedAssetWrapper = styled.div`
	margin: 20px 0 40px 0;

	h4 {
		margin: 0 0 10px 0;
	}
`;

export const FeaturedAssetBody = styled.div`
	width: 100%;
	display: flex;
	justify-content: space-between;
	gap: 40px;

	@media (max-width: ${STYLING.cutoffs.initial}) {
		flex-direction: column;
		gap: 25px;
	}
`;

export const FeaturedAssetInfo = styled.div`
	width: 50%;
	display: flex;
	flex-direction: column;
	gap: 45px;
	padding: 0 120px 0 0;

	p {
		color: ${(props) => props.theme.colors.font.primary};
		font-size: ${(props) => props.theme.typography.size.base};
		font-family: ${(props) => props.theme.typography.family.primary};
		font-weight: ${(props) => props.theme.typography.weight.medium};
		white-space: normal;
		text-overflow: ellipsis;
		overflow-x: hidden;
		line-height: 1.65;
	}

	span {
		color: ${(props) => props.theme.colors.font.alt1};
		font-size: ${(props) => props.theme.typography.size.small};
		font-family: ${(props) => props.theme.typography.family.primary};
		font-weight: ${(props) => props.theme.typography.weight.medium};
		white-space: normal;
		text-overflow: ellipsis;
		overflow-x: hidden;
		line-height: 1.65;
	}

	@media (max-width: ${STYLING.cutoffs.initial}) {
		width: 100%;
		padding: 0;
	}
`;

export const FeaturedAssetActions = styled.div`
	width: 100%;
	display: flex;
	align-items: center;
	gap: 25px;

	button {
		min-width: 0 !important;
		flex: 1 !important;
		margin: 0;

		span {
			font-size: ${(props) => props.theme.typography.size.lg} !important;
			font-family: ${(props) => props.theme.typography.family.alt1} !important;
			font-weight: ${(props) => props.theme.typography.weight.bold} !important;
		}
	}

	@media (max-width: ${STYLING.cutoffs.initial}) {
		button {
			margin: 0 auto 40px auto;
		}
	}
`;

export const FeaturedAssetInfoDivider = styled.div`
	height: 1px;
	width: 100%;
	border-top: 1px solid ${(props) => props.theme.colors.border.primary};
`;

export const FeaturedAssetData = styled.div`
	width: 50%;

	video {
		width: 100%;
		background: ${(props) => props.theme.colors.container.primary.background};
		box-shadow: 0 1px 2px 0.5px ${(props) => props.theme.colors.shadow.primary};
		border-radius: ${STYLING.dimensions.radius.primary};
		transition: all 100ms;

		&:hover {
			opacity: 0.75;
		}
	}

	@media (max-width: ${STYLING.cutoffs.initial}) {
		width: 100%;
	}
`;

export const CreatorsWrapper = styled.div`
	margin: 0 0 60px 0;
`;

export const AssetsWrapper = styled.div``;
