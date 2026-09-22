import React from 'react';

import {
	activateLocalWallet,
	type BrowserWalletId,
	clearLocalWallet,
	connectBrowserWallet,
	disconnectWalletSession,
	type GeneratedWallet,
	generateLocalWalletKey,
	installDevelopmentWallet,
	readLocalWallet,
	readVisibleWalletBalances,
	readWalletKeyfile,
	restoreBrowserWalletSession,
	stageDevelopmentWallet,
	storeLocalWallet,
} from 'api/wallet';

type WalletContextValue = {
	address: string | null;
	arBalance: bigint | null;
	arBalanceDenomination: number;
	arBalanceStatus: 'idle' | 'loading' | 'ready' | 'error';
	aoBalance: bigint | null;
	aoBalanceDenomination: number;
	aoBalanceStatus: 'idle' | 'loading' | 'ready' | 'error';
	connect(walletId: BrowserWalletId): Promise<void>;
	disconnect(): Promise<void>;
	generateLocalWallet(): Promise<GeneratedWallet>;
	importLocalWallet(file: File): Promise<void>;
	openConnectDialog(trigger?: HTMLElement | null): void;
	connectDialogOpen: boolean;
	closeConnectDialog(): void;
	connectDialogRestoreTarget(): HTMLElement | null;
	loadDevelopmentWallet?(file: File): Promise<void>;
};

const WalletContext = React.createContext<WalletContextValue | null>(null);

export default function WalletProvider(props: { children: React.ReactNode }) {
	const [address, setAddress] = React.useState<string | null>(null);
	const [arBalance, setArBalance] = React.useState<bigint | null>(null);
	const [arBalanceDenomination, setArBalanceDenomination] = React.useState(12);
	const [arBalanceStatus, setArBalanceStatus] = React.useState<WalletContextValue['arBalanceStatus']>('idle');
	const [aoBalance, setAoBalance] = React.useState<bigint | null>(null);
	const [aoBalanceDenomination, setAoBalanceDenomination] = React.useState(12);
	const [aoBalanceStatus, setAoBalanceStatus] = React.useState<WalletContextValue['aoBalanceStatus']>('idle');
	const [balanceRevision, setBalanceRevision] = React.useState(0);
	const [connectDialogOpen, setConnectDialogOpen] = React.useState(false);
	const connectDialogTrigger = React.useRef<HTMLElement | null>(null);
	const addressRequests = React.useRef(createLatestAddressCommitter(setAddress));
	const closeConnectDialog = React.useCallback(() => setConnectDialogOpen(false), []);
	const restoreConnectDialogFocus = React.useCallback(() => connectDialogTrigger.current, []);

	const refresh = React.useCallback(async () => {
		const commit = addressRequests.current.begin();
		try {
			commit(await restoreBrowserWalletSession());
		} catch {
			commit(null);
		}
	}, []);

	React.useEffect(() => {
		let cancelled = false;
		void installDevelopmentWallet().then(() => {
			if (cancelled) return;
			const storedWallet = readLocalWallet();
			if (storedWallet) {
				const commit = addressRequests.current.begin();
				void activateLocalWallet(storedWallet).then(commit, () => {
					clearLocalWallet();
					commit(null);
				});
			} else {
				void refresh();
			}
		});
		const refreshWallet = () => {
			setBalanceRevision((revision) => revision + 1);
			void refresh();
		};
		const refreshNetworkBalances = () => setBalanceRevision((revision) => revision + 1);
		window.addEventListener('walletSwitch', refreshWallet);
		window.addEventListener('permawebConnectLoaded', refreshWallet);
		window.addEventListener('aoFetchLoaded', refreshNetworkBalances);
		return () => {
			cancelled = true;
			window.removeEventListener('walletSwitch', refreshWallet);
			window.removeEventListener('permawebConnectLoaded', refreshWallet);
			window.removeEventListener('aoFetchLoaded', refreshNetworkBalances);
			addressRequests.current.invalidate();
		};
	}, [refresh]);

	React.useEffect(() => {
		setArBalance(null);
		setAoBalance(null);
		if (!address) {
			setArBalanceStatus('idle');
			setAoBalanceStatus('idle');
			return;
		}

		const controller = new AbortController();
		setArBalanceStatus('loading');
		setAoBalanceStatus('idle');
		void readVisibleWalletBalances(address, { signal: controller.signal }).then((balances) => {
			if (controller.signal.aborted) return;
			setArBalance(balances.ar.atomicBalance);
			setArBalanceDenomination(balances.ar.denomination);
			setArBalanceStatus(balances.ar.atomicBalance === null ? 'error' : 'ready');
			setAoBalance(balances.ao?.atomicBalance ?? null);
			setAoBalanceDenomination(balances.ao?.denomination ?? 12);
			setAoBalanceStatus(balances.ao ? (balances.ao.atomicBalance === null ? 'error' : 'ready') : 'idle');
		});
		return () => controller.abort();
	}, [address, balanceRevision]);

	const value = React.useMemo<WalletContextValue>(
		() => ({
			address,
			arBalance,
			arBalanceDenomination,
			arBalanceStatus,
			aoBalance,
			aoBalanceDenomination,
			aoBalanceStatus,
			connect: async (walletId) => {
				const commit = addressRequests.current.begin();
				commit(await connectBrowserWallet(walletId));
				setBalanceRevision((revision) => revision + 1);
			},
			disconnect: async () => {
				const commit = addressRequests.current.begin();
				await disconnectWalletSession();
				commit(null);
			},
			generateLocalWallet: async () => {
				const jwk = await generateLocalWalletKey();
				const commit = addressRequests.current.begin();
				const nextAddress = await activateLocalWallet(jwk);
				commit(nextAddress);
				return { address: nextAddress, jwk };
			},
			importLocalWallet: async (file: File) => {
				const jwk = await readWalletKeyfile(file);
				storeLocalWallet(jwk);
				const commit = addressRequests.current.begin();
				commit(await activateLocalWallet(jwk));
			},
			connectDialogOpen,
			closeConnectDialog,
			connectDialogRestoreTarget: restoreConnectDialogFocus,
			openConnectDialog: (trigger) => {
				connectDialogTrigger.current =
					trigger ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
				setConnectDialogOpen(true);
			},
			...(import.meta.env.DEV
				? {
						loadDevelopmentWallet: async (file: File) => {
							await stageDevelopmentWallet(file);
							window.location.reload();
						},
				  }
				: {}),
		}),
		[
			address,
			aoBalance,
			aoBalanceDenomination,
			aoBalanceStatus,
			arBalance,
			arBalanceDenomination,
			arBalanceStatus,
			closeConnectDialog,
			connectDialogOpen,
			restoreConnectDialogFocus,
		]
	);

	return <WalletContext.Provider value={value}>{props.children}</WalletContext.Provider>;
}

export function useWallet() {
	const value = React.useContext(WalletContext);
	if (!value) throw new Error('wallet-provider-missing');
	return value;
}

export function createLatestAddressCommitter(commit: (address: string | null) => void) {
	let latest = 0;
	return {
		begin() {
			const request = ++latest;
			return (address: string | null) => {
				if (request !== latest) return false;
				commit(address);
				return true;
			};
		},
		invalidate() {
			latest += 1;
		},
	};
}
