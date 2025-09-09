import React from 'react';

import { TOKEN_REGISTRY } from 'helpers/config';
import { useTokenValidation } from 'providers/TokenValidationProvider';

import * as S from './styles';

interface TokenHealthIndicatorProps {
	tokenId?: string;
	operation?: 'balance' | 'metadata' | 'transfer' | 'orders';
	showDetails?: boolean;
	className?: string;
}

export default function TokenHealthIndicator({
	tokenId,
	operation = 'balance',
	showDetails = false,
	className,
}: TokenHealthIndicatorProps) {
	const tokenValidation = useTokenValidation();

	// If no specific token, show overall health
	if (!tokenId) {
		const overallHealth = tokenValidation.getOverallTokenHealth();
		const workingTokens = tokenValidation.getWorkingTokens(operation);
		const recommendedToken = tokenValidation.getRecommendedToken(operation);

		return (
			<S.Container className={className}>
				<S.HealthDot health={overallHealth} />
				{showDetails && (
					<S.Details>
						<S.HealthText health={overallHealth}>
							{overallHealth === 'healthy' && 'All tokens working'}
							{overallHealth === 'degraded' &&
								`${workingTokens.length} of ${Object.keys(TOKEN_REGISTRY).length} tokens working`}
							{overallHealth === 'unhealthy' && 'No tokens working'}
						</S.HealthText>
						<S.Recommendation>Recommended: {TOKEN_REGISTRY[recommendedToken]?.name || 'Unknown'}</S.Recommendation>
					</S.Details>
				)}
			</S.Container>
		);
	}

	// Show specific token health
	const health = tokenValidation.getTokenHealth(tokenId);
	const isSupported = tokenValidation.isTokenSupported(tokenId, operation);
	const token = TOKEN_REGISTRY[tokenId];

	if (!token) {
		return (
			<S.Container className={className}>
				<S.HealthDot health="unhealthy" />
				{showDetails && (
					<S.Details>
						<S.HealthText health="unhealthy">Unknown token</S.HealthText>
					</S.Details>
				)}
			</S.Container>
		);
	}

	return (
		<S.Container className={className}>
			<S.HealthDot health={health} />
			{showDetails && (
				<S.Details>
					<S.HealthText health={health}>
						{health === 'healthy' && `${token.name} is working properly`}
						{health === 'degraded' && `${token.name} has limited functionality`}
						{health === 'unhealthy' && `${token.name} is not working`}
					</S.HealthText>
					<S.OperationStatus supported={isSupported}>
						{operation}: {isSupported ? 'Supported' : 'Not supported'}
					</S.OperationStatus>
				</S.Details>
			)}
		</S.Container>
	);
}
