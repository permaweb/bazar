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
	background-color: ${({ health }) => {
		switch (health) {
			case 'healthy':
				return '#22c55e'; // green
			case 'degraded':
				return '#f59e0b'; // amber
			case 'unhealthy':
				return '#ef4444'; // red
			default:
				return '#6b7280'; // gray
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
	color: ${({ health }) => {
		switch (health) {
			case 'healthy':
				return '#22c55e';
			case 'degraded':
				return '#f59e0b';
			case 'unhealthy':
				return '#ef4444';
			default:
				return '#6b7280';
		}
	}};
	font-weight: 500;
`;

export const Recommendation = styled.span`
	color: #6b7280;
	font-size: 11px;
`;

export const OperationStatus = styled.span<SupportedProps>`
	color: ${({ supported }) => (supported ? '#22c55e' : '#ef4444')};
	font-size: 11px;
	font-weight: 500;
`;
