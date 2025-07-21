import React from 'react';

import { TOKEN_REGISTRY } from 'helpers/config';
import {
	clearTokenStatusCache,
	isTokenSupported,
	TokenValidationResult,
	updateTokenStatus,
	validateToken,
} from 'helpers/tokenValidation';

interface TokenValidationContextState {
	// Token validation state
	tokenValidations: { [tokenId: string]: TokenValidationResult };

	// Validation functions
	validateToken: (tokenId: string) => TokenValidationResult;
	isTokenSupported: (tokenId: string, operation: 'balance' | 'metadata' | 'transfer' | 'orders') => boolean;
	updateTokenStatus: (tokenId: string, status: Partial<TokenValidationResult>) => void;
	clearTokenStatusCache: () => void;

	// Token health status
	getTokenHealth: (tokenId: string) => 'healthy' | 'degraded' | 'unhealthy';
	getOverallTokenHealth: () => 'healthy' | 'degraded' | 'unhealthy';

	// Token recommendations
	getRecommendedToken: (operation: 'balance' | 'metadata' | 'transfer' | 'orders') => string;
	getWorkingTokens: (operation: 'balance' | 'metadata' | 'transfer' | 'orders') => string[];
}

const DEFAULT_CONTEXT: TokenValidationContextState = {
	tokenValidations: {},
	validateToken: () => ({
		isValid: false,
		isSupported: false,
		hasBalance: false,
		hasMetadata: false,
		fallbackBalance: '0',
		fallbackMetadata: { name: 'Unknown', symbol: 'UNKNOWN', denomination: 12, description: 'Unknown token' },
	}),
	isTokenSupported: () => false,
	updateTokenStatus: () => {},
	clearTokenStatusCache: () => {},
	getTokenHealth: () => 'unhealthy',
	getOverallTokenHealth: () => 'unhealthy',
	getRecommendedToken: () => 'xU9zFkq3X2ZQ6olwNVvr1vUWIjc3kXTWr7xKQD6dh10', // Default to wAR
	getWorkingTokens: () => ['xU9zFkq3X2ZQ6olwNVvr1vUWIjc3kXTWr7xKQD6dh10'], // Default to wAR
};

const TokenValidationContext = React.createContext<TokenValidationContextState>(DEFAULT_CONTEXT);

export function useTokenValidation(): TokenValidationContextState {
	return React.useContext(TokenValidationContext);
}

export function TokenValidationProvider(props: { children: React.ReactNode }) {
	const [tokenValidations, setTokenValidations] = React.useState<{ [tokenId: string]: TokenValidationResult }>({});

	// Initialize token validations on mount
	React.useEffect(() => {
		const initialValidations: { [tokenId: string]: TokenValidationResult } = {};

		Object.keys(TOKEN_REGISTRY).forEach((tokenId) => {
			initialValidations[tokenId] = validateToken(tokenId);
		});

		setTokenValidations(initialValidations);
	}, []);

	// Enhanced validation function that updates state
	const handleValidateToken = React.useCallback((tokenId: string): TokenValidationResult => {
		const validation = validateToken(tokenId);

		setTokenValidations((prev) => ({
			...prev,
			[tokenId]: validation,
		}));

		return validation;
	}, []);

	// Enhanced update function that updates state
	const handleUpdateTokenStatus = React.useCallback((tokenId: string, status: Partial<TokenValidationResult>) => {
		updateTokenStatus(tokenId, status);

		setTokenValidations((prev) => ({
			...prev,
			[tokenId]: {
				...prev[tokenId],
				...status,
			},
		}));
	}, []);

	// Enhanced clear function that updates state
	const handleClearTokenStatusCache = React.useCallback(() => {
		clearTokenStatusCache();
		setTokenValidations({});
	}, []);

	// Get token health status
	const getTokenHealth = React.useCallback(
		(tokenId: string): 'healthy' | 'degraded' | 'unhealthy' => {
			const validation = tokenValidations[tokenId];

			if (!validation) {
				return 'unhealthy';
			}

			if (validation.isValid && validation.hasBalance && validation.hasMetadata) {
				return 'healthy';
			}

			if (validation.isValid && (validation.hasBalance || validation.hasMetadata)) {
				return 'degraded';
			}

			return 'unhealthy';
		},
		[tokenValidations]
	);

	// Get overall token health
	const getOverallTokenHealth = React.useCallback((): 'healthy' | 'degraded' | 'unhealthy' => {
		const tokenIds = Object.keys(TOKEN_REGISTRY);
		const healthStatuses = tokenIds.map((tokenId) => getTokenHealth(tokenId));

		if (healthStatuses.every((status) => status === 'healthy')) {
			return 'healthy';
		}

		if (healthStatuses.some((status) => status === 'healthy')) {
			return 'degraded';
		}

		return 'unhealthy';
	}, [getTokenHealth]);

	// Get recommended token for specific operation
	const getRecommendedToken = React.useCallback((operation: 'balance' | 'metadata' | 'transfer' | 'orders'): string => {
		// Priority order based on our network analysis
		const priorityOrder = [
			'xU9zFkq3X2ZQ6olwNVvr1vUWIjc3kXTWr7xKQD6dh10', // wAR - most reliable
			'DM3FoZUq_yebASPhgd8pEIRIzDW6muXEhxz5-JwbZwo', // PIXL - partially working
			'L99jaxRKQKJt9CqoJtPaieGPEhJD3wNhR4iGqc8amXs', // Wander - not working
			// AO token removed due to incorrect process ID
		];

		for (const tokenId of priorityOrder) {
			if (isTokenSupported(tokenId, operation)) {
				return tokenId;
			}
		}

		// Fallback to wAR
		return 'xU9zFkq3X2ZQ6olwNVvr1vUWIjc3kXTWr7xKQD6dh10';
	}, []);

	// Get all working tokens for specific operation
	const getWorkingTokens = React.useCallback((operation: 'balance' | 'metadata' | 'transfer' | 'orders'): string[] => {
		return Object.keys(TOKEN_REGISTRY).filter((tokenId) => isTokenSupported(tokenId, operation));
	}, []);

	const contextValue: TokenValidationContextState = {
		tokenValidations,
		validateToken: handleValidateToken,
		isTokenSupported,
		updateTokenStatus: handleUpdateTokenStatus,
		clearTokenStatusCache: handleClearTokenStatusCache,
		getTokenHealth,
		getOverallTokenHealth,
		getRecommendedToken,
		getWorkingTokens,
	};

	return <TokenValidationContext.Provider value={contextValue}>{props.children}</TokenValidationContext.Provider>;
}
