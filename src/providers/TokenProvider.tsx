import React from 'react';

import { getDefaultToken, TOKEN_REGISTRY } from 'helpers/config';

interface TokenType {
	id: string;
	name: string;
	symbol: string;
	logo: string;
	denomination: number;
	description: string;
	priority: number;
}

interface TokenContextState {
	selectedToken: TokenType;
	setSelectedToken: (token: TokenType) => void;
	availableTokens: TokenType[];
}

const DEFAULT_CONTEXT: TokenContextState = {
	selectedToken: getDefaultToken(),
	setSelectedToken: () => {},
	availableTokens: Object.values(TOKEN_REGISTRY).sort((a, b) => a.priority - b.priority),
};

const TokenContext = React.createContext<TokenContextState>(DEFAULT_CONTEXT);

export function useTokenProvider(): TokenContextState {
	return React.useContext(TokenContext);
}

export function TokenProvider(props: { children: React.ReactNode }) {
	const [selectedToken, setSelectedToken] = React.useState<TokenType>(getDefaultToken());
	const availableTokens = Object.values(TOKEN_REGISTRY).sort((a, b) => a.priority - b.priority);

	// Load selected token from localStorage on mount
	React.useEffect(() => {
		const savedTokenId = localStorage.getItem('selectedTokenId');
		if (savedTokenId && TOKEN_REGISTRY[savedTokenId]) {
			setSelectedToken(TOKEN_REGISTRY[savedTokenId]);
		}
	}, []);

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
			}}
		>
			{props.children}
		</TokenContext.Provider>
	);
}
