import actions from 'assets/actions.svg';
import activity from 'assets/activity.svg';
import ar from 'assets/ar.svg';
import arconnect from 'assets/arconnect-wallet-logo.png';
import arrow from 'assets/arrow.svg';
import asset from 'assets/asset.svg';
import audio from 'assets/audio.svg';
import beacon from 'assets/beacon-logo.svg';
import bridge from 'assets/bridge.svg';
import buy from 'assets/buy.svg';
import checkmark from 'assets/checkmark.svg';
import close from 'assets/close.svg';
import collection from 'assets/collection.svg';
import comments from 'assets/comments.svg';
import copy from 'assets/copy.svg';
import dark from 'assets/dark.svg';
import disconnect from 'assets/disconnect.svg';
import discord from 'assets/discord.svg';
import docs from 'assets/docs.svg';
import edit from 'assets/edit.svg';
import github from 'assets/github.svg';
import grid from 'assets/grid.svg';
import html from 'assets/html.svg';
import info from 'assets/info.svg';
import leaderboard from 'assets/leaderboard.svg';
import license from 'assets/license.svg';
import light from 'assets/light.svg';
import link from 'assets/link.svg';
import list from 'assets/list.svg';
import logo from 'assets/logo.svg';
import market from 'assets/market.svg';
import media from 'assets/media.svg';
import menu from 'assets/menu.svg';
import orders from 'assets/orders.svg';
import othent from 'assets/othent.svg';
import overview from 'assets/overview.svg';
import paste from 'assets/paste.svg';
import pause from 'assets/pause.svg';
import pixl from 'assets/pixl.svg';
import play from 'assets/play.svg';
import provenance from 'assets/provenance.svg';
import question from 'assets/question.svg';
import renderer from 'assets/renderer.svg';
import sell from 'assets/sell.svg';
import defaultStampSVG from 'assets/stamp-default.svg';
import superStampSVG from 'assets/stamp-super.svg';
import vouchedStampSVG from 'assets/stamp-vouched.svg';
import stamps from 'assets/stamps.svg';
import star from 'assets/star.svg';
import streak1 from 'assets/streak-1-7.svg';
import streak2 from 'assets/streak-8-14.svg';
import streak3 from 'assets/streak-15-29.svg';
import streak4 from 'assets/streak-30.svg';
import swap from 'assets/swap.svg';
import transfer from 'assets/transfer.svg';
import unsupported from 'assets/unsupported.svg';
import user from 'assets/user.svg';
import users from 'assets/users.svg';
import video from 'assets/video.svg';
import view from 'assets/view.svg';
import wallet from 'assets/wallet.svg';
import wander from 'assets/wander.png';
import x from 'assets/x.svg';
import zen from 'assets/zen.svg';

import { SelectOptionType, WalletEnum } from './types';

const stamp = {
	default: defaultStampSVG,
	super: superStampSVG,
	vouched: vouchedStampSVG,
};

export const AO = {
	module: process.env.MODULE,
	scheduler: process.env.SCHEDULER,
	defaultToken: process.env.DEFAULT_TOKEN,
	ucm: process.env.UCM,
	ucmActivity: process.env.UCM_ACTIVITY,
	pixl: process.env.PIXL,
	collectionsRegistry: process.env.COLLECTIONS_REGISTRY,
	profileRegistry: process.env.PROFILE_REGISTRY,
	profileSrc: process.env.PROFILE_SRC,
	vouch: process.env.VOUCH,
	stamps: process.env.STAMPS,
	ao: '0syT13r0s0tgPmIed95bJnuSqaD29HQNN8D3ElLSrsc',
	wndr: '7GoQfmSOct_aUOWKM4xbKGg6DzAmOgdKwg8Kf-CbHm4',
	pi: '4hXj_E-5fAKmo4E8KjgQvuDJKAFk9P2grhycVmISDLs',
	ario: 'qNvAoz0TgcH7DMg8BCVn8jF32QH5L6T29VjHxhHqqGE',
	usda: 'FBt9A5GA_KXMMSxA2DJ0xZbAq8sLLU2ak-YJe9zDvg8',
	game: 's6jcB3ctSbiDNwR-paJgy5iOAhahXahLul8exSLHbGE',
	pland: 'Jc2bcfEbwHFQ-qY4jqm8L5hc-SggeVA1zlW6DOICWgo',
	smoney: 'K59Wi9uKXBQfTn3zw7L_t-lwHAoq3Fx-V9sCyOY3dFE',
	llamac: 'pazXumQI-HPH7iFGfTC-4_7biSnqz_U67oFAGry5zUY',
	trunk: 'wOrb8b_V8QixWyXZub48Ki5B6OIDyf_p1ngoonsaRpQ',
	lfish: 'ENNFBJS_TpBTh-xR648Pdpx2Z8YgZkRbiqbuzfVv0M4',
	flps: 'It-_AKlEfARBmJdbJew1nG9_hIaZt0t20wQc28mFGBE',
};

export const HB = {
	defaultNode: 'https://app-1.forward.computer',
};
export const AOCONFIG = {
	cu_url: 'https://cu.ao-testnet.xyz',
	cu_af_url: 'https://cu-af.dataos.so',
};

export const getAOConfig = () => {
	return AOCONFIG;
};

export const REFORMATTED_ASSETS = {
	[AO.defaultToken]: {
		title: 'Wrapped AR',
		logo: 'L99jaxRKQKJt9CqoJtPaieGPEhJD3wNhR4iGqc8amXs',
		denomination: 12,
	},
	[AO.pixl]: {
		title: 'PIXL Token',
		logo: 'czR2tJmSr7upPpReXu6IuOc2H7RuHRRAhI7DXAUlszU',
		denomination: 6,
	},
	[AO.stamps]: {
		title: 'STAMP Token',
		logo: 'kg0d-QRW1kD9lwBErRD9CGQogTp5hgPfkf1i7ApE4WU',
		denomination: 12,
	},
	[AO.pi]: {
		title: 'PI Token',
		logo: 'zmQwyD6QiZge10OG2HasBqu27Zg0znGkdFRufOq6rv0',
		denomination: 12,
	},
	[AO.ao]: {
		title: 'AO',
		logo: 'UkS-mdoiG8hcAClhKK8ch4ZhEzla0mCPDOix9hpdSFE',
		denomination: 12,
	},
	[AO.wndr]: {
		title: 'Wander Token',
		logo: 'xUO2tQglSYsW89aLYN8ErGivZqezoDaEn95JniaCBZk',
		denomination: 18,
	},
	[AO.ario]: {
		title: 'ARIO Token',
		logo: 'GIayVyo49wof1hOtgLcJ_XAE6OuF5MeYiYsgu3z4gxk',
		denomination: 6,
	},
	[AO.usda]: {
		title: 'USDA Token',
		logo: 'seXozJrsP0OgI0gvAnr8zmfxiHHb5iSlI9wMI8SdamE',
		denomination: 12,
	},
	[AO.game]: {
		title: 'Game Token',
		logo: '-c4VdpgmfuS4YadtLuxVZzTd2DQ3ipodA6cz8pwjn20',
		denomination: 18,
	},
	[AO.flps]: {
		title: 'FLPS Token',
		logo: 'VoI5dCNcl9PYu0xrRYaFk9i8sUMKFBRKcQqOb8uRPOw',
		denomination: 12,
	},
	[AO.smoney]: {
		title: 'Space Money',
		logo: 'Jr8gjPMCE1aTgN73tRfseL1ZD-OFbGHoA__MWl0QxI4',
		denomination: 18,
	},
	[AO.llamac]: {
		title: 'Llama Coin',
		logo: '9FSEgmUsrug7kTdZJABDekwTGJy7YG7KaN5khcbwcX4',
		denomination: 12,
	},
	[AO.trunk]: {
		title: 'TRUNK',
		logo: 'hqg-Em9DdYHYmMysyVi8LuTGF8IF_F7ZacgjYiSpj0k',
		denomination: 3,
	},
	[AO.lfish]: {
		title: 'Legendary Fish',
		logo: 'Esm9ZtALCN0oM0GGBUeh90qCV_V_0d21hwobUZ7IWA8',
		denomination: 0,
	},
	[AO.pland]: {
		title: 'Protocol Land',
		logo: 'DvtICU2c-wM41VZIcrMutHmo5b6WV1CDXaavOJ4a5YU',
		denomination: 18,
	},
	mqBYxpDsolZmJyBdTK8TJp_ftOuIUXVYcSQ8MYZdJg0: {
		title: 'APUS Token',
		logo: 'sixqgAh5MEevkhwH4JuCYwmumaYMTOBi3N5_N1GQ6Uc',
		denomination: 12,
	},
};

export const LICENSES = {
	udl: {
		address: 'dE0rmDfl9_OWjkDznNEXHaSO_JohJkRolvMzaCroUdw',
		label: 'Universal Data License',
	},
};

export const APP = {
	name: 'Bazar',
};

export const ASSETS = {
	actions,
	activity,
	ar,
	arconnect,
	arrow,
	asset,
	audio,
	bridge,
	buy,
	checkmark,
	close,
	collection,
	comments,
	copy,
	dark,
	disconnect,
	discord,
	docs,
	edit,
	github,
	grid,
	html,
	info,
	leaderboard,
	license,
	light,
	link,
	list,
	logo,
	market,
	media,
	menu,
	orders,
	othent,
	overview,
	paste,
	pause,
	pixl,
	play,
	provenance,
	question,
	renderer,
	sell,
	star,
	swap,
	transfer,
	unsupported,
	stamps,
	stamp,
	streak1,
	streak2,
	streak3,
	streak4,
	user,
	users,
	view,
	video,
	wallet,
	wander,
	x,
	zen,
	beacon,
};

export const AR_WALLETS = [
	{ type: WalletEnum.wander, logo: ASSETS.wander },
	{ type: WalletEnum.beacon, logo: ASSETS.beacon },
	{ type: WalletEnum.othent, logo: ASSETS.othent },
];

export const DOM = {
	loader: 'loader',
	notification: 'notification',
	overlay: 'overlay',
};

export const GATEWAYS = {
	arweave: 'arweave.net',
	goldsky: 'arweave-search.goldsky.com',
};

export const STYLING = {
	cutoffs: {
		desktop: '1200px',
		initial: '1024px',
		max: '1440px',
		tablet: '840px',
		tabletSecondary: '768px',
		secondary: '540px',
	},
	dimensions: {
		button: {
			height: '32.5px',
			width: 'fit-content',
			radius: '30px',
		},
		borderRadiusField: '5px',
		borderRadiusWrapper: '10px',
		form: {
			small: '45px',
			max: '47.5px',
		},
		nav: {
			height: '75px',
		},
		radius: {
			primary: '10px',
			alt1: '15px',
			alt2: '5px',
			alt3: '2.5px',
		},
	},
};

export const TAGS = {
	keys: {
		access: 'Access-Fee',
		avatar: 'Avatar',
		banner: 'Banner',
		collectionId: 'Collection-Id',
		collectionName: 'Collection-Name',
		commericalUse: 'Commercial-Use',
		contentType: 'Content-Type',
		creator: 'Creator',
		currency: 'Currency',
		dataModelTraining: 'Data-Model-Training',
		dataProtocol: 'Data-Protocol',
		dateCreated: 'Date-Created',
		derivations: 'Derivations',
		description: 'Description',
		displayName: 'Display-Name',
		handle: 'Handle',
		implements: 'Implements',
		initialOwner: 'Initial-Owner',
		license: 'License',
		name: 'Name',
		paymentAddress: 'Payment-Address',
		paymentMode: 'Payment-Mode',
		profileIndex: 'Profile-Index',
		protocolName: 'Protocol-Name',
		renderWith: 'Render-With',
		thumbnail: 'Thumbnail',
		title: 'Title',
	},
	values: {
		collection: 'AO-Collection',
		profileVersions: {
			'1': 'Account-0.3',
		},
	},
};

export const WALLET_PERMISSIONS = ['ACCESS_ADDRESS', 'ACCESS_PUBLIC_KEY', 'SIGN_TRANSACTION', 'DISPATCH', 'SIGNATURE'];

function createURLs() {
	const base = `/`;
	const collection = `${base}collection/`;
	const profile = `${base}profile/`;
	return {
		base: base,
		asset: `${base}asset/`,
		collection: collection,
		collectionAssets: (id: string) => `${collection}${id}/assets/`,
		collectionActivity: (id: string) => `${collection}${id}/activity/`,
		collections: `${base}collections/`,
		docs: `${base}docs/`,
		terms: `${base}terms/`,
		profile: profile,
		profileAssets: (address: string) => `${profile}${address}/assets/`,
		profileCollections: (address: string) => `${profile}${address}/collections/`,
		profileListings: (address: string) => `${profile}${address}/listings/`,
		profileActivity: (address: string) => `${profile}${address}/activity/`,
		quest: `${base}quest/`,
		notFound: `${base}404`,
	};
}

export const URLS = createURLs();

export const CURSORS = {
	p1: 'P1',
	end: 'END',
};

export const PAGINATORS = {
	default: 100,
	landing: {
		assets: 30,
	},
	collection: {
		assets: 15,
	},
	profile: {
		assets: 15,
	},
};

export const REDIRECTS = {
	github: `https://github.com/permaweb/bazar`,
	x: `https://x.com/OurBazAR`,
	discord: `https://discord.gg/vS2fYJNucN`,
	bazarStudio: `https://studio_bazar.arweave.net`,
	aox: `https://aox.arweave.net`,
	arconnect: `https://wander.app`,
	warDepot: `https://wardepot.arweave.net`,
	explorer: (messageId: string) => `https://lunar.arweave.net/#/explorer/${messageId}`,
};

export const DEFAULTS = {
	banner: 'eXCtpVbcd_jZ0dmU2PZ8focaKxBGECBQ8wMib7sIVPo',
	thumbnail: 'lJovHqM9hwNjHV5JoY9NGWtt0WD-5D4gOqNL2VWW5jk',
};

export const ACTIVITY_SORT_OPTIONS: SelectOptionType[] = [
	{ id: 'new-to-old', label: 'Newest to oldest' },
	{ id: 'old-to-new', label: 'Oldest to newest' },
];

export const ASSET_SORT_OPTIONS: SelectOptionType[] = [
	{ id: 'recently-listed', label: 'Recently listed' },
	{ id: 'stamps', label: 'By stamps' },
	{ id: 'low-to-high', label: 'Low to high' },
	{ id: 'high-to-low', label: 'High to low' },
];

export const CONTENT_TYPES = {
	json: 'application/json',
	mp4: 'video/mp4',
	textPlain: 'text/plain',
};

export const UPLOAD_CONFIG = {
	node1: 'https://up.arweave.net',
	node2: 'https://turbo.ardrive.io',
	batchSize: 1,
	chunkSize: 7500000,
	dispatchUploadSize: 100 * 1024,
};

export const FLAGS = {
	MAINTENANCE: false,
};

export const ARNS = {
	CACHE_DURATION: 24 * 60 * 60 * 1000, // 24 hours
	DEFAULT_DISPLAY_LENGTH: 20,
};

export const STORAGE = {
	walletType: `wallet-type`,
	profile: (id: string) => `profile-${id}`,
	arns: (address: string) => `arns::${address}`,
};

// Token Registry - Easy to add new tokens
export const TOKEN_REGISTRY = {
	[AO.pi]: {
		id: AO.pi,
		name: 'PI Token',
		symbol: 'PI',
		logo: 'zmQwyD6QiZge10OG2HasBqu27Zg0znGkdFRufOq6rv0', // Logo will be fetched dynamically from token metadata
		denomination: 12, // PI token denomination from metadata
		description: 'Permaweb Index token',
		priority: 1,
	},
	[AO.ao]: {
		id: AO.ao,
		name: 'AO',
		symbol: 'AO',
		logo: 'UkS-mdoiG8hcAClhKK8ch4ZhEzla0mCPDOix9hpdSFE', // Logo will be fetched dynamically from token metadata
		denomination: 12, // PI token denomination from metadata
		description: 'AO Token',
		priority: 2,
	},
	[AO.defaultToken]: {
		id: AO.defaultToken,
		name: 'Wrapped AR',
		symbol: 'wAR',
		logo: 'L99jaxRKQKJt9CqoJtPaieGPEhJD3wNhR4iGqc8amXs', // Correct wAR logo
		denomination: 12,
		description: 'Wrapped Arweave token',
		priority: 3, // Primary token
	},
	[AO.pixl]: {
		id: AO.pixl,
		name: 'PIXL Token',
		symbol: 'PIXL',
		logo: 'czR2tJmSr7upPpReXu6IuOc2H7RuHRRAhI7DXAUlszU', // PIXL logo
		denomination: 6,
		description: 'PIXL protocol token',
		priority: 4,
	},
	[AO.wndr]: {
		id: AO.wndr,
		name: 'Wander Token',
		symbol: 'WNDR',
		logo: 'xUO2tQglSYsW89aLYN8ErGivZqezoDaEn95JniaCBZk', // WANDER token logo on Arweave
		denomination: 18,
		description: 'Wander protocol token',
		priority: 5,
	},
	[AO.ario]: {
		id: AO.ario,
		name: 'ARIO Token',
		symbol: 'ARIO',
		logo: 'GIayVyo49wof1hOtgLcJ_XAE6OuF5MeYiYsgu3z4gxk', // Logo will be fetched dynamically from token metadata
		denomination: 6, // Default denomination, will be updated from metadata
		description: 'ARIO protocol token',
		priority: 6,
	},
	[AO.usda]: {
		id: AO.usda,
		name: 'USDA Token',
		symbol: 'USDA',
		logo: 'seXozJrsP0OgI0gvAnr8zmfxiHHb5iSlI9wMI8SdamE', // Logo will be fetched dynamically from token metadata
		denomination: 12, // Default denomination, will be updated from metadata
		description: 'USDA stablecoin token',
		priority: 7,
	},
	[AO.game]: {
		id: AO.game,
		name: 'Game Token',
		symbol: 'GAME',
		logo: '-c4VdpgmfuS4YadtLuxVZzTd2DQ3ipodA6cz8pwjn20', // Provided logo
		denomination: 18, // Correct denomination
		description: 'Game protocol token',
		priority: 8,
	},
};

// NOTE: All tokens in this registry will have their balances fetched for both profile and wallet, and the UI will display the combined total (profileBalance + walletBalance) for each token. This applies to wAR, PIXL, Wander, PI, and any future tokens.

// Helper function to get available tokens
export const getAvailableTokens = () => {
	return Object.values(TOKEN_REGISTRY).sort((a, b) => a.priority - b.priority);
};

// Helper function to get token by ID
export const getTokenById = (tokenId: string) => {
	return TOKEN_REGISTRY[tokenId] || null;
};

// Helper function to get default token
export const getDefaultToken = () => {
	return TOKEN_REGISTRY[AO.defaultToken];
};

// Delegation Configuration
export const DELEGATION = {
	CONTROLLER: 'cuxSKjGJ-WDB9PzSkVkVVrIBSh3DrYHYz44usQOj5yE',
	PIXL_PROCESS: '3eZ6_ry6FD9CB58ImCQs6Qx_rJdDUGhz-D2W1AqzHD8', // PIXL Fair Launch Process (from Decent Land walkthrough)
	ANCHOR: '00000000000000000000000000007046',
	BASIS_POINTS: {
		FULL: 10000, // 100%
		HALF: 5000, // 50%
		QUARTER: 2500, // 25%
	},
};

export const CUSTOM_ORDERBOOKS = {
	mqBYxpDsolZmJyBdTK8TJp_ftOuIUXVYcSQ8MYZdJg0: 'tb8W1Cn9ZiSuK-84x0h7fIUJoltD8C8j3eIU9IKgM70',
	// 'gx_jKk-hy8-sB4Wv5WEuvTTVyIRWW3We7rRHthcohBQ': 't8wHK3HjEvdD30CdgbSZ7IIkxB3T50C0XO954CNF_fA',
	'Nx-_Ichdp-9uO_ZKg2DLWPiRlg-DWrSa2uGvINxOjaE': 'q_sB3jK0QdHcempCcmOSqxO_vwID_FsYCkMo0zaQt5E',
	'GegJSRSQptBJEF5lcr4XEqWLYFUnNr3_zKQ-P_DnDQs': 'IOD6GBbHBBKOy07IfKFdmAeCFB0_xxhfTFa5H90QPL8',
	'7GoQfmSOct_aUOWKM4xbKGg6DzAmOgdKwg8Kf-CbHm4': 'C3MbGmYaXLOZN0Ujxz0sZY2ycUBCC2wgmDoWGIVVQPk',
	OiNYKJ16jP7uj7z0DJO7JZr9ClfioGacpItXTn9fKn8: 'DT-G-rAkjodaHahIsvxKKFSt6kuFl4thxSB5qEmoT_8',
	n2MhPK0O3yEvY2zW73sqcmWqDktJxAifJDrri4qireI: 'vhniAUMtSrSyElue3TagT-RSMgbwec5jBmnieFWbBJg',
	'K59Wi9uKXBQfTn3zw7L_t-lwHAoq3Fx-V9sCyOY3dFE': 't96wTmxzbOEdXS7wkp5xWIjZI7S0_UnTuF_s_cdjxtE',
	'Jc2bcfEbwHFQ-qY4jqm8L5hc-SggeVA1zlW6DOICWgo': '2BFh4Hf5ifJ_vY7hwW6t6ZnA4szqneFFkFHmb-QjERQ',
	's6jcB3ctSbiDNwR-paJgy5iOAhahXahLul8exSLHbGE': 'AgSUvl5MRT8X1j-d5ywmpkQ27_SK3yaPju2qjTS5zYY',
	'5IrQh9aoWTLlLTXogXdGd7FcVubFKOaw7NCRGnkyXCM': '4krW8tYJhC15dAmXm5zdaQMItM1ZAu3xwB-OwrYjJXQ',
	qNvAoz0TgcH7DMg8BCVn8jF32QH5L6T29VjHxhHqqGE: 'cmJVjh6ADoTsrYWSwqztGt73sD4MOmE00l2fuT17vFU',
	// 'kfq7JKVeu-Z9qA0y-0YKXbgNqKJzENqVl0KSrPDOBl4': 'oicS7bqcRFF1fWiwGARPJTkA7dyccXmaMji7mNHIXME',
	// aKmI800gM1Gk12JvwBe2MPxAvXT1ZPfRBxmkUpLJv7g: 'O0-SAOn67j6C8CJEnYsRkWCMH_FrUZxxntemuR8fP6s',
	// OsK9Vgjxo0ypX_HLz2iJJuh4hp3I80yA9KArsJjIloU: '6Pv23ob3yEafK2bPcI4cg8mCkpRliYdZAMymEG7tKJk',
	'DM3FoZUq_yebASPhgd8pEIRIzDW6muXEhxz5-JwbZwo': 'd1p2oTsZM8mZ-zR5m65VPK15qzqvGJjyor2Qhs0v7Es',
};
