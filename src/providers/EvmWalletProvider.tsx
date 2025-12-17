import '@rainbow-me/rainbowkit/styles.css';

import React from 'react';
import { darkTheme, getDefaultConfig, RainbowKitProvider } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAccount, useBalance } from 'wagmi';
import { WagmiProvider } from 'wagmi';
import { arbitrum, mainnet, optimism, polygon } from 'wagmi/chains';
import { ethers } from 'ethers';

// Session Key Management
export interface SessionKeyData {
	privateKey: string;
	address: string;
	mainAccount: string;
	expiry: number;
}

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function generateSessionKey(mainAccount: string): SessionKeyData {
	const wallet = ethers.Wallet.createRandom();

	return {
		privateKey: wallet.privateKey,
		address: wallet.address,
		mainAccount: mainAccount.toLowerCase(),
		expiry: Date.now() + ONE_WEEK_MS,
	};
}

export function getSessionKey(mainAccount: string): SessionKeyData | null {
	if (!mainAccount) return null;

	const storageKey = `ethSessionKey_${mainAccount.toLowerCase()}`;
	const stored = localStorage.getItem(storageKey);

	if (!stored) return null;

	try {
		const sessionData = JSON.parse(stored);

		// Check if expired or about to expire (within 1 day)
		if (Date.now() + ONE_DAY_MS > sessionData.expiry) {
			console.log('Session key expired or expiring soon');
			return null;
		}

		// Verify it belongs to this main account
		if (sessionData.mainAccount.toLowerCase() !== mainAccount.toLowerCase()) {
			console.log('Session key account mismatch');
			return null;
		}

		return sessionData;
	} catch (e) {
		console.warn('Invalid session key data:', e);
		localStorage.removeItem(storageKey);
		return null;
	}
}

export function storeSessionKey(sessionData: SessionKeyData): void {
	const storageKey = `ethSessionKey_${sessionData.mainAccount.toLowerCase()}`;
	localStorage.setItem(storageKey, JSON.stringify(sessionData));
}

export function clearSessionKey(mainAccount: string): void {
	if (!mainAccount) return;
	const storageKey = `ethSessionKey_${mainAccount.toLowerCase()}`;
	localStorage.removeItem(storageKey);
}

// RainbowKit Configuration
const config = getDefaultConfig({
	appName: 'BazAR',
	projectId: 'YOUR_PROJECT_ID', // TODO: Get from WalletConnect Cloud
	chains: [mainnet, polygon, arbitrum, optimism],
	ssr: false, // BazAR is client-side only
});

const queryClient = new QueryClient();

// Context
interface EvmWalletContextState {
	evmAddress: string | null;
	evmBalance: string | null;
	sessionKey: SessionKeyData | null;
	isConnected: boolean;
	chainId: number | null;
	initializeSession: (mainAccount: string) => Promise<SessionKeyData | null>;
	clearSession: () => void;
	refreshSession: () => Promise<void>;
}

const DEFAULT_CONTEXT: EvmWalletContextState = {
	evmAddress: null,
	evmBalance: null,
	sessionKey: null,
	isConnected: false,
	chainId: null,
	initializeSession: async () => null,
	clearSession: () => {},
	refreshSession: async () => {},
};

const EvmWalletContext = React.createContext<EvmWalletContextState>(DEFAULT_CONTEXT);

export function useEvmWallet(): EvmWalletContextState {
	return React.useContext(EvmWalletContext);
}

// Inner provider that uses wagmi hooks
function EvmWalletProviderInner({ children }: { children: React.ReactNode }) {
	const { address, isConnected, chainId } = useAccount();
	const { data: balance } = useBalance({ address });

	const [evmAddress, setEvmAddress] = React.useState<string | null>(null);
	const [evmBalance, setEvmBalance] = React.useState<string | null>(null);
	const [sessionKey, setSessionKey] = React.useState<SessionKeyData | null>(null);

	// Handle wallet connection/disconnection
	React.useEffect(() => {
		if (address && isConnected) {
			setEvmAddress(address);

			// Auto-initialize session key on connection
			initializeSession(address);
		} else {
			setEvmAddress(null);
			setSessionKey(null);
		}
	}, [address, isConnected]);

	// Update balance
	React.useEffect(() => {
		if (balance) {
			setEvmBalance(balance.formatted);
		} else {
			setEvmBalance(null);
		}
	}, [balance]);

	// Listen for account changes (MetaMask)
	React.useEffect(() => {
		if (typeof window !== 'undefined' && window.ethereum) {
			const handleAccountsChanged = (accounts: string[]) => {
				if (accounts.length === 0) {
					console.log('MetaMask locked or disconnected');
					setEvmAddress(null);
					setSessionKey(null);
				} else {
					const newAccount = accounts[0];
					console.log('Account changed to:', newAccount);
					setEvmAddress(newAccount);
					initializeSession(newAccount);
				}
			};

			window.ethereum.on('accountsChanged', handleAccountsChanged);

			return () => {
				window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
			};
		}
	}, []);

	const initializeSession = React.useCallback(async (mainAccount: string): Promise<SessionKeyData | null> => {
		if (!mainAccount) return null;

		try {
			// Check for existing valid session
			let session = getSessionKey(mainAccount);

			if (!session) {
				// Generate new session key
				session = generateSessionKey(mainAccount);
				storeSessionKey(session);
				console.log('New session key generated:', session.address);
			} else {
				console.log('Reusing existing session key:', session.address);
			}

			setSessionKey(session);
			return session;
		} catch (error) {
			console.error('Error initializing session key:', error);
			return null;
		}
	}, []);

	const clearSession = React.useCallback(() => {
		if (evmAddress) {
			clearSessionKey(evmAddress);
			setSessionKey(null);
			console.log('Session key cleared');
		}
	}, [evmAddress]);

	const refreshSession = React.useCallback(async () => {
		if (evmAddress) {
			// Clear existing session
			clearSessionKey(evmAddress);

			// Generate new session
			const newSession = await initializeSession(evmAddress);
			if (newSession) {
				console.log('Session key refreshed');
			}
		}
	}, [evmAddress, initializeSession]);

	const value: EvmWalletContextState = {
		evmAddress,
		evmBalance,
		sessionKey,
		isConnected,
		chainId: chainId || null,
		initializeSession,
		clearSession,
		refreshSession,
	};

	return <EvmWalletContext.Provider value={value}>{children}</EvmWalletContext.Provider>;
}

// Main provider export
export function EvmWalletProvider({ children }: { children: React.ReactNode }) {
	return (
		<WagmiProvider config={config}>
			<QueryClientProvider client={queryClient}>
				<RainbowKitProvider
					theme={darkTheme({
						accentColor: '#7b3fe4',
						accentColorForeground: 'white',
						borderRadius: 'medium',
					})}
				>
					<EvmWalletProviderInner>{children}</EvmWalletProviderInner>
				</RainbowKitProvider>
			</QueryClientProvider>
		</WagmiProvider>
	);
}
