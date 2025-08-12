import React from 'react';

import { getWorkingGateway, initializeWayfinder, resolveGatewayUrl } from 'helpers/wayfinder';

interface WayfinderContextState {
	resolveGateway: (url: string) => Promise<string>;
	isInitialized: boolean;
}

interface WayfinderProviderProps {
	children: React.ReactNode;
}

const DEFAULT_CONTEXT: WayfinderContextState = {
	resolveGateway: async (url: string) => url.replace('ar://', 'https://arweave.net/'), // fallback
	isInitialized: false,
};

const WayfinderContext = React.createContext<WayfinderContextState>(DEFAULT_CONTEXT);

export function useWayfinderProvider(): WayfinderContextState {
	return React.useContext(WayfinderContext);
}

export function WayfinderProvider(props: WayfinderProviderProps) {
	const [isInitialized, setIsInitialized] = React.useState(false);

	React.useEffect(() => {
		(async function initializeWayfinderProvider() {
			try {
				// Initialize global gateways (this now includes testing and caching a working gateway)
				await initializeWayfinder();

				setIsInitialized(true);
				console.log('✅ WayfinderProvider initialized successfully with working gateway');
			} catch (error) {
				console.error('❌ Failed to initialize WayfinderProvider:', error);
				// Still mark as initialized to allow fallback behavior
				setIsInitialized(true);
			}
		})();
	}, []);

	const resolveGateway = React.useCallback(async (url: string): Promise<string> => {
		try {
			return await resolveGatewayUrl(url);
		} catch (error) {
			console.error('❌ Failed to resolve gateway for URL:', url, error);
			// Fallback to arweave.net
			return url.replace('ar://', 'https://arweave.net/');
		}
	}, []);

	const contextValue: WayfinderContextState = {
		resolveGateway,
		isInitialized,
	};

	return <WayfinderContext.Provider value={contextValue}>{props.children}</WayfinderContext.Provider>;
}
