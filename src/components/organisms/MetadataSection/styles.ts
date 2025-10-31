import styled from 'styled-components';

import { fadeIn2, open } from 'helpers/animations';
import { STYLING } from 'helpers/config';

export const SectionTitle = styled.h4`
	color: ${(props) => props.theme.colors.font.primary};
	font-size: ${(props) => props.theme.typography.size.base};
	font-weight: ${(props) => props.theme.typography.weight.bold};
	margin: 0 0 15px 0;
`;

export const TraitsGrid = styled.div`
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
	gap: 12px;
	margin-bottom: 20px;
`;

export const TraitCard = styled.div`
	background: ${(props) => props.theme.colors.container.primary.background};
	border: 1px solid ${(props) => props.theme.colors.border.primary};
	border-radius: ${STYLING.dimensions.radius.alt2};
	padding: 12px;
	text-align: center;
	transition: all 0.2s;

	&:hover {
		border-color: ${(props) => props.theme.colors.border.alt1};
		transform: translateY(-1px);
	}

	animation: ${open} ${fadeIn2};
`;

export const TraitType = styled.div`
	color: ${(props) => props.theme.colors.font.alt1};
	font-size: 11px;
	font-weight: ${(props) => props.theme.typography.weight.bold};
	text-transform: uppercase;
	letter-spacing: 0.5px;
	margin-bottom: 4px;
`;

export const TraitValue = styled.div`
	color: ${(props) => props.theme.colors.font.primary};
	font-size: ${(props) => props.theme.typography.size.small};
	font-weight: ${(props) => props.theme.typography.weight.bold};
	word-break: break-word;
`;

export const TopicsWrapper = styled.div`
	margin-bottom: 20px;
`;

export const TopicsGrid = styled.div`
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
`;

export const TopicTag = styled.span`
	background: ${(props) => props.theme.colors.button.primary.background};
	color: ${(props) => props.theme.colors.button.primary.label};
	padding: 6px 12px;
	border-radius: ${STYLING.dimensions.radius.alt2};
	font-size: 12px;
	font-weight: ${(props) => props.theme.typography.weight.bold};

	animation: ${open} ${fadeIn2};
`;

export const AttributesWrapper = styled.div`
	margin-bottom: 20px;
`;
