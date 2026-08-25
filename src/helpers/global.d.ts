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
	allowNotFound?(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
	networkPolicy?(): Promise<{
		version: 1;
		arweaveGateway: { url: string; ownership: 'community' | 'default' | 'personal' };
		permanentContent: { url: string; ownership: 'community' | 'default' | 'personal' };
		publishing: { url: string; ownership: 'community' | 'default' | 'personal' };
		ao: {
			processReads: ReadonlyArray<{ url: string; ownership: 'community' | 'default' | 'personal' }>;
			scheduleReads: ReadonlyArray<{ url: string; ownership: 'community' | 'default' | 'personal' }>;
			linkedStateReads: ReadonlyArray<{ url: string; ownership: 'community' | 'default' | 'personal' }>;
			observerRelay?: { url: string; ownership: 'community' | 'default' | 'personal' };
			scheduleWrite?: { url: string; ownership: 'community' | 'default' | 'personal' };
			directWrite?: { url: string; ownership: 'community' | 'default' | 'personal' };
			fallbackMode: 'custom' | 'hosted' | 'personal-first' | 'personal-only';
		};
	}>;
}

interface Window {
	arweaveWallet?: ArweaveWalletProvider;
	permawebConnect?: ArweaveWalletProvider;
	aoFetch?: PermawebOsAoFetch;
}
