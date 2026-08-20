interface ArweaveWalletProvider {
	connect(permissions: string[], appInfo?: { name: string; logo?: string }): Promise<void>;
	disconnect?(): Promise<void>;
	getActiveAddress?(): Promise<string>;
	getPermissions?(): Promise<string[]>;
	sign(transaction: unknown): Promise<any>;
}

interface PermawebOsAoFetch {
	(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
	invalidate(input: RequestInfo | URL, init?: RequestInit): Promise<void>;
	cacheMetadata(response: Response):
		| {
				status: 'fresh' | 'stale' | 'miss';
				age: number;
				origin?: string;
				revalidation?: Promise<Response>;
		  }
		| undefined;
	readonly peers: readonly string[];
	ready(): Promise<readonly string[]>;
}

interface Window {
	arweaveWallet?: ArweaveWalletProvider;
	permawebConnect?: ArweaveWalletProvider;
	aoFetch?: PermawebOsAoFetch;
}
