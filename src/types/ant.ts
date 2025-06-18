export interface ANTState {
	Records: any;
	Balances: any;
	Initialized: any;
	TotalSupply: any;
	Controllers: any;
}

export interface TokenSupply {
	total: number;
	circulating: number;
	staked: number;
}

export interface ANTInfo {
	Name: string;
	Ticker: string;
	Description: string;
	Keywords: string[];
	Denomination?: string;
	Owner: string;
	Logo: string;
	'Total-Supply': string;
	Handlers?: string[];
	HandlerNames?: string[];
	processId?: string;
	type?: 'lease' | 'permabuy';
	state?: ANTState;
	endTimestamp?: number;
	startTimestamp?: number;
	listed?: boolean;
	price?: string;
	isPrimary?: boolean;
	tokenSupply?: TokenSupply;
}

export interface MarketplaceRecord {
	transactionId: string;
	ttlSeconds: number;
	priority?: number;
	listed?: boolean;
	price?: string;
}

export interface ANTMetadata {
	Name: string;
	Ticker: string;
	Description: string;
	Keywords: string[];
	Denomination: string;
	Owner: string;
	Logo: string;
	'Total-Supply': string;
	Handlers?: string[];
	HandlerNames?: string[];
	endTimestamp?: number;
	startTimestamp?: number;
}

export interface ARNSRecord {
	name: string;
	processId: string;
	startTimestamp: number;
	endTimestamp: number;
	type: 'lease' | 'permabuy';
	antInfo: ANTInfo;
}

export interface ARNSMetadataProps {
	metadata: ANTInfo;
	compact?: boolean;
	onTransfer?: () => void;
}

export interface ANTMarketData {
	name: string;
	processId: string;
	ticker: string;
	description: string;
	owner: string;
	logo: string;
	lastUpdate?: number;
	forSale?: boolean;
	price?: number;
}

export interface ARNSSearchProps {
	onResultsFound: (results: ARNSRecord[]) => void;
	onLoading: (isLoading: boolean) => void;
	onError: (error: string | null) => void;
}
