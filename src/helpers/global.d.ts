interface Window {
	arweaveWallet?: {
		connect(permissions: string[]): Promise<void>;
		disconnect?(): Promise<void>;
		getActiveAddress?(): Promise<string>;
		sign(transaction: unknown): Promise<any>;
	};
}
