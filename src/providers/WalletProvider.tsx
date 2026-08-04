import Arweave from 'arweave';
import React from 'react';

type WalletContextValue = {
	address: string | null;
	connect(): Promise<void>;
	disconnect(): Promise<void>;
	loadDevelopmentWallet?(file: File): Promise<void>;
};

const WALLET_PERMISSIONS = [
	'ACCESS_ADDRESS',
	'ACCESS_PUBLIC_KEY',
	'SIGN_TRANSACTION',
];
const ARWEAVE_ADDRESS = /^[A-Za-z0-9_-]{43}$/;

const WalletContext = React.createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: React.PropsWithChildren) {
	installDevelopmentWallet();
	const [address, setAddress] = React.useState<string | null>(null);
	const addressRequests = React.useRef(createLatestAddressCommitter(setAddress));

	const refresh = React.useCallback(async () => {
		const commit = addressRequests.current.begin();
		try {
			commit((await window.arweaveWallet?.getActiveAddress?.()) ?? null);
		} catch {
			commit(null);
		}
	}, []);

	React.useEffect(() => {
		void refresh();
		window.addEventListener('walletSwitch', refresh);
		return () => {
			window.removeEventListener('walletSwitch', refresh);
			addressRequests.current.invalidate();
		};
	}, [refresh]);

	const value = React.useMemo(
		() => ({
			address,
			connect: async () => {
				const commit = addressRequests.current.begin();
				commit(await connectWallet(window.arweaveWallet));
			},
			disconnect: async () => {
				const commit = addressRequests.current.begin();
				await window.arweaveWallet?.disconnect?.();
				commit(null);
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
		[address]
	);
	return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
	const value = React.useContext(WalletContext);
	if (!value) throw new Error('wallet-provider-missing');
	return value;
}

export async function connectWallet(wallet: Window['arweaveWallet']) {
	if (!wallet) throw new Error('Install an Arweave wallet extension to continue.');
	await wallet.connect(WALLET_PERMISSIONS);
	let address: string | undefined;
	try {
		address = await wallet.getActiveAddress?.();
	} catch {
		throw new Error('The wallet connected, but its active address could not be read. Unlock or reconnect the wallet and try again.');
	}
	if (!address || !ARWEAVE_ADDRESS.test(address)) {
		throw new Error('The wallet connected, but no valid active address was returned. Unlock or reconnect the wallet and try again.');
	}
	return address;
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
