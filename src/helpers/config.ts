import activity from 'assets/activity.svg';
import ar from 'assets/ar.svg';
import arconnect from 'assets/arconnect-wallet-logo.png';
import arrow from 'assets/arrow.svg';
import audio from 'assets/audio.svg';
import buy from 'assets/buy.svg';
import checkmark from 'assets/checkmark.svg';
import close from 'assets/close.svg';
import comments from 'assets/comments.svg';
import html from 'assets/html.svg';
import info from 'assets/info.svg';
import license from 'assets/license.svg';
import logo from 'assets/logo.svg';
import market from 'assets/market.svg';
import media from 'assets/media.svg';
import menu from 'assets/menu.svg';
import orders from 'assets/orders.svg';
import othent from 'assets/othent.svg';
import overview from 'assets/overview.svg';
import paste from 'assets/paste.svg';
import provenance from 'assets/provenance.svg';
import renderer from 'assets/renderer.svg';
import sell from 'assets/sell.svg';
import transfer from 'assets/transfer.svg';
import unsupported from 'assets/unsupported.svg';
import user from 'assets/user.svg';
import video from 'assets/video.svg';
import wallet from 'assets/wallet.svg';
import x from 'assets/x.svg';

import { SelectOptionType, WalletEnum } from './types';

export const AOS = {
	module: 'SBNb1qPQ1TDwpD_mboxm2YllmMLXpWw4U8P9Ff8W9vk',
	scheduler: '_GQ33BkPtZrqxA84vM8Zk-N2aO0toNNu_C-l-rawrBA',
};

export const PROCESSES = {
	ucm: 'fzRGvSW2oSop9xGLxs5mcaRtCbrbug8imI_uRZHKdiU',
	token: 'IRv02cCZGmBVMhmPlL63sce4djgRgkY1J_3DUl_feUw',
	profileRegistry: 'kFYMezhjcPCZLr2EkkwzIXP5A64QmtME6Bxa8bGmbzI',
	profileSrc: 'VgdzqxtexVBVz6faY2A8VuFAkgljR-krybqtGgTqt8g',
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
	activity,
	ar,
	arconnect,
	arrow,
	audio,
	buy,
	checkmark,
	close,
	comments,
	html,
	info,
	license,
	logo,
	market,
	media,
	menu,
	orders,
	othent,
	overview,
	paste,
	provenance,
	renderer,
	sell,
	transfer,
	unsupported,
	user,
	video,
	wallet,
	x,
};

export const AR_WALLETS = [
	{ type: WalletEnum.arConnect, logo: ASSETS.arconnect },
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
		},
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
		commericalUse: 'Commercial-Use',
		contentType: 'Content-Type',
		creator: 'Creator',
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
	const profile = `${base}profile/`;
	return {
		base: base,
		asset: `${base}asset/`,
		collection: `${base}collection/`,
		collections: `${base}collections/`,
		docs: `${base}docs/`,
		profile: profile,
		profileAssets: (address: string) => `${profile}${address}/assets/`,
		profileCollections: (address: string) => `${profile}${address}/collections/`,
		profileListings: (address: string) => `${profile}${address}/listings/`,
		profileActivity: (address: string) => `${profile}${address}/activity/`,
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
		assets: 20,
	},
	collection: {
		assets: 20,
	},
	profile: {
		assets: 15,
	},
};

export const REDIRECTS = {
	x: `https://twitter.com/OurBazAR`,
	helix: `https://helix.arweave.dev`,
};

export const DEFAULTS = {
	banner: 'eXCtpVbcd_jZ0dmU2PZ8focaKxBGECBQ8wMib7sIVPo',
	thumbnail: 'lJovHqM9hwNjHV5JoY9NGWtt0WD-5D4gOqNL2VWW5jk',
};

export const ASSET_SORT_OPTIONS: SelectOptionType[] = [
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
