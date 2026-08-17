interface ArweaveWalletProvider {
	connect(permissions: string[], appInfo?: { name: string; logo?: string }): Promise<void>;
	disconnect?(): Promise<void>;
	getActiveAddress?(): Promise<string>;
	sign(transaction: unknown): Promise<any>;
}

interface Window {
	arweaveWallet?: ArweaveWalletProvider;
	permawebConnect?: ArweaveWalletProvider;
}
