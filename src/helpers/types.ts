import { ProfileType, RegistryProfileType } from '@permaweb/aoprofile';

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
	logo: string | null;
	transferable: boolean;
	balances: { [address: string]: string } | null;
	metadata?: {
		CoverArt?: string;
		CollectionId?: string;
		OrderbookId?: string;
		[key: string]: any;
	};
};

export type AssetOrderType = {
	creator: string | null;
	dateCreated: string | null;
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
	currency: string | null;
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
		collectionId?: string | null;
		collectionName?: string | null;
		contentType?: string | null;
	};
};

export type AssetDetailType = AssetType & {
	state?: AssetStateType;
	orderbook?: {
		id: string;
		activityId?: string;
		orders?: AssetOrderType[];
	};
};

export type OwnerType = {
	address: string;
	profile: RegistryProfileType | null;
	ownerQuantity?: number;
	ownerPercentage?: number;
};

export type ListingType = AssetOrderType & { orderbookId: string; profile: RegistryProfileType };

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
	id: string;
	title: string;
	name?: string;
	description: string | null;
	creator: string;
	dateCreated: string;
	banner: string | null;
	thumbnail: string | null;
	activityProcess: string | null;
};

export type CollectionDetailType = CollectionType & {
	assetIds: string[];
	creatorProfile: ProfileType;
	metrics: CollectionMetricsType;
	activity?: any;
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

export type BatchAGQLResponseType = { [queryKey: string]: DefaultGQLResponseType };

export enum WalletEnum {
	wander = 'wander',
	othent = 'othent',
	beacon = 'beacon',
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

export type AssetSortType = 'high-to-low' | 'low-to-high' | 'recently-listed' | 'stamps';

export type IdGroupType = { [index: string]: string[] };

export type ButtonType = 'primary' | 'alt1' | 'alt2' | 'alt3' | 'success' | 'warning';

export type SelectOptionType = { id: string; label: string };

export type UploadMethodType = 'default' | 'turbo';

export type NotificationType = {
	message: string;
	status: 'success' | 'warning';
};

export type AssetViewType = 'trading' | 'reading';

export type StreakType = { address: string; days: number; lastHeight: number; profile: RegistryProfileType | null };

export type VouchType = { score: number; isVouched: boolean };

export type ResponseType = { status: boolean; message: string | null };

export type StampType = { total: number; vouched: number; hasStamped?: boolean };

export type StampsType = Record<string, { total: number; vouched: number }>;

export type GqlEdge = {
	cursor: string;
	node: {
		id: string;
		tags: { name: string; value: string }[];
		block: { timestamp: number };
		recipient: string;
	};
};

export interface FormattedActivity {
	ListedOrders: Array<{
		OrderId: string;
		Timestamp: number;
		Quantity: string;
		DominantToken: string;
		SwapToken: string;
		Price: string;
		Sender: string;
	}>;
	PurchasesByAddress: Record<string, number>;
	TotalVolume: Record<string, string>;
	SalesByAddress: Record<string, number>;
	CancelledOrders: string[];
	ExecutedOrders: Array<{
		OrderId: string;
		Receiver: string;
		Quantity: string;
		DominantToken: string;
		Timestamp: number;
		SwapToken: string;
		Price: string;
		Sender: string;
	}>;
}
