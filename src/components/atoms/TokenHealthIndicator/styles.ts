import styled from 'styled-components';

type HealthType = 'healthy' | 'degraded' | 'unhealthy';

interface HealthProps {
	health: HealthType;
}

interface SupportedProps {
	supported: boolean;
}

export const Container = styled.div`
	display: flex;
	align-items: center;
	gap: 8px;
	font-size: 12px;
`;

export const HealthDot = styled.div<HealthProps>`
	width: 8px;
	height: 8px;
	border-radius: 50%;
	background-color: ${({ health, theme }) => {
		switch (health) {
			case 'healthy':
				return theme.colors.indicator.primary;
			case 'degraded':
				return theme.colors.stats.alt6;
			case 'unhealthy':
				return theme.colors.warning.primary;
			default:
				return theme.colors.font.alt3;
		}
	}};
	flex-shrink: 0;
`;

export const Details = styled.div`
	display: flex;
	flex-direction: column;
	gap: 2px;
`;

export const HealthText = styled.span<HealthProps>`
	color: ${({ health, theme }) => {
		switch (health) {
			case 'healthy':
				return theme.colors.indicator.primary;
			case 'degraded':
				return theme.colors.stats.alt6;
			case 'unhealthy':
				return theme.colors.warning.primary;
			default:
				return theme.colors.font.alt3;
		}
	}};
	font-weight: 500;
`;

export const Recommendation = styled.span`
	color: ${(props) => props.theme.colors.font.alt3};
	font-size: 11px;
`;

export const OperationStatus = styled.span<SupportedProps>`
	color: ${({ supported, theme }) => (supported ? theme.colors.indicator.primary : theme.colors.warning.primary)};
	font-size: 11px;
	font-weight: 500;
`;
