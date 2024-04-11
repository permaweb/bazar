export type EntryOrderType = {
	DepositTxId: string;
	DateCreated: string;
	OriginalQuantity: string;
	Creator: string;
	Id: string;
	Token: string;
	Quantity: string;
	Price?: string;
};

export type OrderbookEntryType = {
	Pair: string[];
	Orders?: EntryOrderType[];
	PriceData?: {
		DominantToken: string;
		Vwap: string;
		MatchLogs: {
			Id: string;
			Quantity: string;
			Price: string;
		}[];
		Block: string;
	};
};

export type AssetStateType = {
	name: string | null;
	ticker: string | null;
	denomination: number | null;
	balances: { [address: string]: string } | null;
};

export type AssetOrderType = {
	creator: string | null;
	dateCreated: string | null;
	depositTxId: string | null;
	id: string | null;
	originalQuantity: string | null;
	price?: string | null;
	quantity: string | null;
	token: string | null;
	currency: string | null;
};

export type LicenseValueType = {
	value: string;
	icon?: string;
	endText?: string;
};

export type LicenseType = {
	access: LicenseValueType | null;
	derivations: LicenseValueType | null;
	commercialUse: LicenseValueType | null;
	dataModelTraining: LicenseValueType | null;
	paymentMode: string | null;
	paymentAddress: string | null;
};

export type AssetType = {
	data: {
		id: string;
		creator: string;
		title: string;
		description: string | null;
		dateCreated: number;
		blockHeight: number;
		renderWith: string | null;
		license: string | null;
		udl: LicenseType | null;
		thumbnail: string | null;
		implementation: string | null;
	};
};

export type AssetDetailType = AssetType & {
	state?: AssetStateType;
	orders?: AssetOrderType[];
};

export type ProfileType = {
	txId: string;
	displayName: string | null;
	handle: string | null;
	avatar: string | null;
	walletAddress: string;
	profileIndex: string | null;
	banner: string | null;
};

export type FullProfileType = ProfileType & {
	bio: string;
};

export type OwnerType = {
	address: string;
	ownerQuantity?: number;
	ownerPercentage?: number;
	profile: ProfileType | null;
};

export type ListingType = AssetOrderType & { profile: ProfileType };

export type CollectionManifestType = {
	type: string;
	items: string[];
};

export type CollectionMetricsType = {
	assetCount: number | null;
	floorPrice: number | null;
	percentageListed: number | null;
	defaultCurrency: string;
};

export type CollectionType = {
	data: {
		id: string;
		creator: string;
		title: string;
		description: string | null;
		dateCreated: number;
		blockHeight: number;
		banner: string | null;
		thumbnail: string | null;
	};
};

export type CollectionDetailType = CollectionType & {
	assetIdGroups: IdGroupType;
	creatorProfile: ProfileType;
	metrics: CollectionMetricsType;
};

export type TagType = { name: string; value: string };

export type TagFilterType = { name: string; values: string[]; match?: string };

export type BaseGQLArgsType = {
	ids: string[] | null;
	tagFilters: TagFilterType[] | null;
	owners: string[] | null;
	cursor: string | null;
	paginator?: number;
	minBlock?: number;
	maxBlock?: number;
};

export type GQLArgsType = { gateway: string } & BaseGQLArgsType;

export type QueryBodyGQLArgsType = BaseGQLArgsType & { gateway?: string; queryKey?: string };

export type BatchGQLArgsType = {
	gateway: string;
	entries: { [queryKey: string]: BaseGQLArgsType };
};

export type GQLNodeResponseType = {
	cursor: string | null;
	node: {
		id: string;
		tags: TagType[];
		data: {
			size: string;
			type: string;
		};
		block?: {
			height: number;
			timestamp: number;
		};
		owner?: {
			address: string;
		};
		address?: string;
		timestamp?: number;
	};
};

export type GQLResponseType = {
	count: number;
	nextCursor: string | null;
	previousCursor: string | null;
};

export type DefaultGQLResponseType = {
	data: GQLNodeResponseType[];
} & GQLResponseType;

export type CollectionGQLResponseType = {
	data: CollectionType[];
} & GQLResponseType;

export type BatchAGQLResponseType = { [queryKey: string]: DefaultGQLResponseType };

export enum WalletEnum {
	arConnect = 'arconnect',
	othent = 'othent',
}

export type RenderType = 'renderer' | 'raw';

export type ContentType = 'renderer' | any;

export type AssetRenderType = {
	url: string;
	type: RenderType;
	contentType: ContentType;
};

export type DateType = 'iso' | 'epoch';

export type FormFieldType = 'number' | 'password';

export type TabType = 'primary' | 'alt1';

export type AssetMarketActionOrderType = 'buy' | 'sell' | 'transfer';

export type ReduxActionType = {
	type: string;
	payload: any;
};

export type ValidationType = {
	status: boolean;
	message: string | null;
};

export type AssetSortType = 'low-to-high' | 'high-to-low';

export type IdGroupType = { [index: string]: string[] };

export type ButtonType = 'primary' | 'alt1' | 'alt2' | 'alt3' | 'success' | 'warning';
