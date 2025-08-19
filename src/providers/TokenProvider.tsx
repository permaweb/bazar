import React from 'react';

import { getDefaultToken, TOKEN_REGISTRY } from 'helpers/config';
import { getEnhancedTokenMetadata, preloadTokenMetadata, TokenMetadata } from 'helpers/tokenMetadata';

interface TokenType {
	id: string;
	name: string;
	symbol: string;
	logo?: string;
	denomination: number;
	description: string;
	priority: number;
}

interface TokenContextState {
	selectedToken: TokenType;
	setSelectedToken: (token: TokenType) => void;
	availableTokens: TokenType[];
	isLoadingMetadata: boolean;
	refreshTokenMetadata: () => Promise<void>;
}

const DEFAULT_CONTEXT: TokenContextState = {
	selectedToken: getDefaultToken(),
	setSelectedToken: () => {},
	availableTokens: Object.values(TOKEN_REGISTRY).sort((a, b) => a.priority - b.priority),
	isLoadingMetadata: false,
	refreshTokenMetadata: async () => {},
};

const TokenContext = React.createContext<TokenContextState>(DEFAULT_CONTEXT);

export function useTokenProvider(): TokenContextState {
	return React.useContext(TokenContext);
}

export function TokenProvider(props: { children: React.ReactNode }) {
	const [selectedToken, setSelectedToken] = React.useState<TokenType>(getDefaultToken());
	const [availableTokens, setAvailableTokens] = React.useState<TokenType[]>(
		Object.values(TOKEN_REGISTRY).sort((a, b) => a.priority - b.priority)
	);
	const [isLoadingMetadata, setIsLoadingMetadata] = React.useState(false);

	// Enhanced function to refresh token metadata
	const refreshTokenMetadata = React.useCallback(async () => {
		setIsLoadingMetadata(true);
		try {
			console.log('Refreshing token metadata...');

			// Get all token IDs from registry
			const tokenIds = Object.keys(TOKEN_REGISTRY);

			// Fetch enhanced metadata for all tokens
			const enhancedTokens = await Promise.all(
				tokenIds.map(async (tokenId) => {
					try {
						const enhanced = await getEnhancedTokenMetadata(tokenId);
						return {
							id: enhanced.id,
							name: enhanced.name,
							symbol: enhanced.symbol,
							logo: enhanced.logo,
							denomination: enhanced.denomination,
							description: enhanced.description,
							priority: enhanced.priority,
						};
					} catch (error) {
						console.warn(`Failed to enhance metadata for ${tokenId}:`, error);
						// Fallback to registry data
						const registryToken = TOKEN_REGISTRY[tokenId];
						return {
							...registryToken,
							logo:
								registryToken.logo !== 'defaultLogo' && registryToken.logo !== 'dynamicLogo'
									? registryToken.logo
									: undefined,
						};
					}
				})
			);

			// Sort by priority and update state
			const sortedTokens = enhancedTokens.sort((a, b) => a.priority - b.priority);
			setAvailableTokens(sortedTokens);

			// Update selected token if it has new metadata
			const updatedSelectedToken = sortedTokens.find((token) => token.id === selectedToken.id);
			if (updatedSelectedToken) {
				setSelectedToken(updatedSelectedToken);
			}

			console.log('✅ Token metadata refresh complete');
		} catch (error) {
			console.error('Failed to refresh token metadata:', error);
		} finally {
			setIsLoadingMetadata(false);
		}
	}, [selectedToken.id]);

	// Load selected token from localStorage and preload metadata on mount
	React.useEffect(() => {
		const initializeTokens = async () => {
			// Load saved token from localStorage
			const savedTokenId = localStorage.getItem('selectedTokenId');
			if (savedTokenId && TOKEN_REGISTRY[savedTokenId]) {
				setSelectedToken(TOKEN_REGISTRY[savedTokenId]);
			}

			// Preload metadata for all tokens in background
			try {
				await preloadTokenMetadata();
				// After preloading, refresh with enhanced metadata
				await refreshTokenMetadata();
			} catch (error) {
				console.warn('Failed to preload token metadata:', error);
			}
		};

		initializeTokens();
	}, [refreshTokenMetadata]);

	// Save selected token to localStorage when it changes
	const handleSetSelectedToken = React.useCallback((token: TokenType) => {
		setSelectedToken(token);
		localStorage.setItem('selectedTokenId', token.id);
	}, []);

	return (
		<TokenContext.Provider
			value={{
				selectedToken,
				setSelectedToken: handleSetSelectedToken,
				availableTokens,
				isLoadingMetadata,
				refreshTokenMetadata,
			}}
		>
			{props.children}
		</TokenContext.Provider>
	);
}
