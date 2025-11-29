import styled from 'styled-components';

export const Wrapper = styled.div`
	width: 100%;
`;

export const FeaturedWrapper = styled.div`
	margin: 0 0 40px 0;
`;

export const TokenWrapper = styled.div<{ disabled: boolean }>`
	width: 100%;
	overflow: hidden;
	margin: 20px 0 0 0;
	transition: all 100ms;
	a {
		min-height: 100%;
		min-width: 100%;
		height: 100%;
		width: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		transition: all 100ms;
		padding: 20px;
		border: 1px solid transparent;
	}
	&:hover {
		background: ${(props) =>
			props.disabled
				? props.theme.colors.container.primary.active
				: props.theme.colors.container.alt1.background} !important;
		border: 1px solid
			${(props) => (props.disabled ? props.theme.colors.border.primary : props.theme.colors.border.alt2)} !important;
	}
`;

export const TokenImage = styled.div<{}>`
	height: 300px;
	width: 300px;
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

export const ActivityWrapper = styled.div`
	margin: 0 0 60px 0;
`;

export const TokensWrapper = styled.div`
	margin: 0 0 60px 0;
`;

export const CreatorsWrapper = styled.div`
	margin: 0 0 60px 0;
`;

export const AssetsWrapper = styled.div``;
