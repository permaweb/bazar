import styled from 'styled-components';

export const Wrapper = styled.div`
	display: flex;
	flex-direction: column;
	gap: 30px;
	padding: 30px;
	max-width: 1200px;
	margin: 0 auto;
`;

export const Header = styled.div`
	text-align: center;
	margin-bottom: 20px;

	h1 {
		color: ${(props) => props.theme.colors.font.primary};
		font-size: ${(props) => props.theme.typography.size.large};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		margin-bottom: 10px;
	}

	p {
		color: ${(props) => props.theme.colors.font.alt1};
		font-size: ${(props) => props.theme.typography.size.small};
	}
`;

export const TestSection = styled.div`
	background: ${(props) => props.theme.colors.container.primary};
	border: 1px solid ${(props) => props.theme.colors.border.primary};
	border-radius: ${(props) => props.theme.styling.dimensions.radius.primary};
	padding: 20px;

	h2 {
		color: ${(props) => props.theme.colors.font.primary};
		font-size: ${(props) => props.theme.typography.size.medium};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		margin-bottom: 15px;
	}
`;

export const Form = styled.div`
	display: flex;
	flex-direction: column;
	gap: 15px;
	max-width: 400px;
`;

export const CheckboxWrapper = styled.div`
	display: flex;
	align-items: center;
	gap: 10px;

	label {
		display: flex;
		align-items: center;
		gap: 8px;
		color: ${(props) => props.theme.colors.font.primary};
		font-size: ${(props) => props.theme.typography.size.small};
		cursor: pointer;

		input[type='checkbox'] {
			width: 16px;
			height: 16px;
			cursor: pointer;
		}
	}
`;

export const ResultsSection = styled.div`
	background: ${(props) => props.theme.colors.container.primary};
	border: 1px solid ${(props) => props.theme.colors.border.primary};
	border-radius: ${(props) => props.theme.styling.dimensions.radius.primary};
	padding: 20px;

	h2 {
		color: ${(props) => props.theme.colors.font.primary};
		font-size: ${(props) => props.theme.typography.size.medium};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		margin-bottom: 15px;
	}
`;

export const ResultsContent = styled.div`
	display: flex;
	flex-direction: column;
	gap: 15px;
`;

export const TestResult = styled.div`
	background: ${(props) => props.theme.colors.container.alt1};
	border: 1px solid ${(props) => props.theme.colors.border.alt1};
	border-radius: ${(props) => props.theme.styling.dimensions.radius.alt1};
	padding: 15px;

	h3 {
		color: ${(props) => props.theme.colors.font.primary};
		font-size: ${(props) => props.theme.typography.size.small};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		margin-bottom: 10px;
	}

	p {
		color: ${(props) => props.theme.colors.font.alt1};
		font-size: ${(props) => props.theme.typography.size.xSmall};
		margin-bottom: 5px;

		strong {
			color: ${(props) => props.theme.colors.font.primary};
		}
	}
`;

export const InfoSection = styled.div`
	background: ${(props) => props.theme.colors.container.alt2};
	border: 1px solid ${(props) => props.theme.colors.border.alt2};
	border-radius: ${(props) => props.theme.styling.dimensions.radius.primary};
	padding: 20px;

	h2 {
		color: ${(props) => props.theme.colors.font.primary};
		font-size: ${(props) => props.theme.typography.size.medium};
		font-weight: ${(props) => props.theme.typography.weight.bold};
		margin-bottom: 15px;
	}

	ol {
		color: ${(props) => props.theme.colors.font.alt1};
		font-size: ${(props) => props.theme.typography.size.small};
		padding-left: 20px;

		li {
			margin-bottom: 8px;
		}
	}
`;
