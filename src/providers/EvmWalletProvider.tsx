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
		const timeUntilExpiry = sessionData.expiry - Date.now();
		const isExpired = timeUntilExpiry <= 0;
		const isExpiringSoon = timeUntilExpiry <= ONE_DAY_MS;

		if (isExpired || isExpiringSoon) {
			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					location: 'EvmWalletProvider.tsx:44',
					message: 'Session key expired or expiring soon',
					data: {
						mainAccount,
						sessionAddress: sessionData.address,
						expiry: sessionData.expiry,
						timeUntilExpiry,
						isExpired,
						isExpiringSoon,
						daysUntilExpiry: Math.floor(timeUntilExpiry / (24 * 60 * 60 * 1000)),
						note: 'A new session key will be generated. This is expected behavior after 7 days.',
					},
					timestamp: Date.now(),
					sessionId: 'debug-session',
					runId: 'run1',
					hypothesisId: 'KK',
				}),
			}).catch(() => {});
			// #endregion
			console.log(
				'Session key expired or expiring soon. Time until expiry:',
				Math.floor(timeUntilExpiry / (24 * 60 * 60 * 1000)),
				'days'
			);
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
		// #region agent log
		fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				location: 'EvmWalletProvider.tsx:124',
				message: 'Wallet connection state changed',
				data: {
					address,
					isConnected,
					currentEvmAddress: evmAddress,
					currentSessionKey: sessionKey?.address,
				},
				timestamp: Date.now(),
				sessionId: 'debug-session',
				runId: 'run1',
				hypothesisId: 'JJ',
			}),
		}).catch(() => {});
		// #endregion

		if (address && isConnected) {
			setEvmAddress(address);

			// Auto-initialize session key on connection
			// Only initialize if we don't already have a session key for this address
			if (!sessionKey || sessionKey.mainAccount.toLowerCase() !== address.toLowerCase()) {
				// #region agent log
				fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						location: 'EvmWalletProvider.tsx:140',
						message: 'Initializing session key for connected wallet',
						data: {
							address,
							hasExistingSession: !!sessionKey,
							existingSessionAddress: sessionKey?.address,
							existingSessionMainAccount: sessionKey?.mainAccount,
						},
						timestamp: Date.now(),
						sessionId: 'debug-session',
						runId: 'run1',
						hypothesisId: 'JJ',
					}),
				}).catch(() => {});
				// #endregion
				initializeSession(address);
			} else {
				// #region agent log
				fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						location: 'EvmWalletProvider.tsx:155',
						message: 'Skipping session key init - already have valid session',
						data: {
							address,
							sessionKeyAddress: sessionKey.address,
							sessionKeyMainAccount: sessionKey.mainAccount,
						},
						timestamp: Date.now(),
						sessionId: 'debug-session',
						runId: 'run1',
						hypothesisId: 'JJ',
					}),
				}).catch(() => {});
				// #endregion
			}
		} else {
			setEvmAddress(null);
			setSessionKey(null);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [address, isConnected]); // Removed initializeSession and sessionKey to prevent infinite loop

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

		// #region agent log
		fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				location: 'EvmWalletProvider.tsx:169',
				message: 'initializeSession: Starting',
				data: {
					mainAccount,
					currentSessionKey: sessionKey?.address,
					storageKey: `ethSessionKey_${mainAccount.toLowerCase()}`,
				},
				timestamp: Date.now(),
				sessionId: 'debug-session',
				runId: 'run1',
				hypothesisId: 'II',
			}),
		}).catch(() => {});
		// #endregion

		try {
			// Check for existing valid session
			let session = getSessionKey(mainAccount);

			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					location: 'EvmWalletProvider.tsx:185',
					message: 'initializeSession: Session key lookup result',
					data: {
						mainAccount,
						foundExisting: !!session,
						sessionAddress: session?.address,
						sessionExpiry: session?.expiry,
						timeUntilExpiry: session ? session.expiry - Date.now() : null,
					},
					timestamp: Date.now(),
					sessionId: 'debug-session',
					runId: 'run1',
					hypothesisId: 'II',
				}),
			}).catch(() => {});
			// #endregion

			if (!session) {
				// Generate new session key
				session = generateSessionKey(mainAccount);
				storeSessionKey(session);
				console.log('New session key generated:', session.address);
				// #region agent log
				fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						location: 'EvmWalletProvider.tsx:200',
						message: 'initializeSession: NEW session key generated',
						data: {
							mainAccount,
							sessionAddress: session.address,
							sessionExpiry: session.expiry,
							storageKey: `ethSessionKey_${mainAccount.toLowerCase()}`,
							warning: 'This should only happen once per wallet!',
						},
						timestamp: Date.now(),
						sessionId: 'debug-session',
						runId: 'run1',
						hypothesisId: 'II',
					}),
				}).catch(() => {});
				// #endregion
			} else {
				console.log('Reusing existing session key:', session.address);
				// #region agent log
				fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						location: 'EvmWalletProvider.tsx:215',
						message: 'initializeSession: Reusing existing session key',
						data: {
							mainAccount,
							sessionAddress: session.address,
							sessionExpiry: session.expiry,
							timeUntilExpiry: session.expiry - Date.now(),
						},
						timestamp: Date.now(),
						sessionId: 'debug-session',
						runId: 'run1',
						hypothesisId: 'II',
					}),
				}).catch(() => {});
				// #endregion
			}

			setSessionKey(session);
			return session;
		} catch (error) {
			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/5c5bd03e-3b23-4d26-96d2-4949305ee115', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					location: 'EvmWalletProvider.tsx:230',
					message: 'initializeSession: Error occurred',
					data: {
						mainAccount,
						error: error instanceof Error ? error.message : String(error),
						errorStack: error instanceof Error ? error.stack : undefined,
					},
					timestamp: Date.now(),
					sessionId: 'debug-session',
					runId: 'run1',
					hypothesisId: 'II',
				}),
			}).catch(() => {});
			// #endregion
			console.error('Error initializing session key:', error);
			return null;
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []); // Removed sessionKey dependency to prevent infinite loop - session key is retrieved from localStorage, not state

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
