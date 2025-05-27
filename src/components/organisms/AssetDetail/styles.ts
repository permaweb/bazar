import styled from 'styled-components';

import { STYLING } from 'helpers/config';

export const Wrapper = styled.article`
	width: 100%;
	padding: 20px;
	max-width: 1200px;
	margin: 0 auto;

	@media (max-width: ${STYLING.cutoffs.initial}) {
		padding: 15px;
	}

	@media (max-width: ${STYLING.cutoffs.tablet}) {
		padding: 10px;
	}
`;

export const Header = styled.header`
	margin-bottom: 20px;

	h1 {
		font-size: ${(props) => props.theme.typography.size.large};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		color: ${(props) => props.theme.colors.font.primary};
		margin: 0 0 10px 0;
		line-height: 1.2;

		@media (max-width: ${STYLING.cutoffs.initial}) {
			font-size: ${(props) => props.theme.typography.size.medium};
		}
	}
`;

export const Description = styled.p`
	font-size: ${(props) => props.theme.typography.size.regular};
	color: ${(props) => props.theme.colors.font.alt1};
	line-height: 1.5;
	margin: 0;

	@media (max-width: ${STYLING.cutoffs.initial}) {
		font-size: ${(props) => props.theme.typography.size.small};
	}
`;

export const Content = styled.main`
	display: grid;
	gap: 20px;
	grid-template-columns: 1fr;

	@media (min-width: ${STYLING.cutoffs.initial}) {
		grid-template-columns: 2fr 1fr;
	}
`;

export const ARNSMetadataWrapper = styled.section`
	margin-top: 20px;
	padding: 15px;
	background: ${(props) => props.theme.colors.container.alt3.background};
	border: 1px solid ${(props) => props.theme.colors.border.alt4};
	border-radius: ${STYLING.dimensions.radius.primary};

	@media (max-width: ${STYLING.cutoffs.initial}) {
		padding: 10px;
	}
`;

export const LoadingMessage = styled.div`
	text-align: center;
	padding: 20px;
	color: ${(props) => props.theme.colors.font.alt1};
`;

export const ErrorMessage = styled.div`
	text-align: center;
	padding: 20px;
	color: ${(props) => props.theme.colors.font.error};
`;

// Accessibility helper class
export const VisuallyHidden = styled.span`
	position: absolute;
	width: 1px;
	height: 1px;
	padding: 0;
	margin: -1px;
	overflow: hidden;
	clip: rect(0, 0, 0, 0);
	white-space: nowrap;
	border: 0;
`;
