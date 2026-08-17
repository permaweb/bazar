interface BazarBrowserWallet {
	connect(permissions: string[], appInfo?: { name: string }): Promise<void>;
	disconnect?(): Promise<void>;
	getActiveAddress?(): Promise<string>;
	sign(transaction: unknown): Promise<any>;
}

interface Window {
	arweaveWallet?: BazarBrowserWallet;
	permawebConnect?: BazarBrowserWallet;
}
