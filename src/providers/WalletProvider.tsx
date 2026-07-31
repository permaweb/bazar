import Arweave from 'arweave';
import React from 'react';

type WalletContextValue = {
	address: string | null;
	connect(): Promise<void>;
	disconnect(): Promise<void>;
	loadDevelopmentWallet?(file: File): Promise<void>;
};

const WalletContext = React.createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: React.PropsWithChildren) {
	installDevelopmentWallet();
	const [address, setAddress] = React.useState<string | null>(null);

	const refresh = React.useCallback(async () => {
		try {
			setAddress((await window.arweaveWallet?.getActiveAddress?.()) ?? null);
		} catch {
			setAddress(null);
		}
	}, []);

	React.useEffect(() => {
		void refresh();
		window.addEventListener('walletSwitch', refresh);
		return () => window.removeEventListener('walletSwitch', refresh);
	}, [refresh]);

	const value = React.useMemo(
		() => ({
			address,
			connect: async () => {
				if (!window.arweaveWallet) throw new Error('Install an Arweave wallet extension to continue.');
				await window.arweaveWallet.connect([
					'ACCESS_ADDRESS',
					'ACCESS_PUBLIC_KEY',
					'SIGN_TRANSACTION',
				]);
				await refresh();
			},
			disconnect: async () => {
				await window.arweaveWallet?.disconnect?.();
				setAddress(null);
			},
			...(import.meta.env.DEV
				? {
						loadDevelopmentWallet: async (file: File) => {
							const wallet = JSON.parse(await file.text());
							if (
								wallet?.kty !== 'RSA' ||
								typeof wallet?.n !== 'string' ||
								typeof wallet?.d !== 'string'
							) {
								throw new Error('Invalid Arweave JWK.');
							}
							localStorage.setItem('bazar:e2e-wallet', JSON.stringify(wallet));
							window.location.reload();
						},
				  }
				: {}),
		}),
		[address, refresh]
	);
	return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
	const value = React.useContext(WalletContext);
	if (!value) throw new Error('wallet-provider-missing');
	return value;
}

function installDevelopmentWallet() {
	if (!import.meta.env.DEV || window.arweaveWallet) return;
	const stored = localStorage.getItem('bazar:e2e-wallet');
	if (!stored) return;
	try {
		const wallet = JSON.parse(stored);
		const arweave = Arweave.init({});
		let address: string | undefined;
		window.arweaveWallet = {
			connect: async () => undefined,
			disconnect: async () => undefined,
			getActiveAddress: async () => {
				address ??= await arweave.wallets.jwkToAddress(wallet);
				return address;
			},
			sign: async (transaction: any) => {
				await arweave.transactions.sign(transaction, wallet);
				return transaction;
			},
		};
	} catch {
		localStorage.removeItem('bazar:e2e-wallet');
	}
}
