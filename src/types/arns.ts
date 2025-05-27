export interface ARNSTokenState {
	Name: string;
	Ticker: string;
	Owner: string;
	ProcessId: string;
	Logo?: string;
	Description?: string;
	Keywords?: string[];
	Records?: {
		[key: string]: {
			transactionId: string;
			ttlSeconds: number;
		};
	};
	Controllers?: string[];
}

export interface ARNSMetadataProps {
	metadata: ARNSTokenState;
}
