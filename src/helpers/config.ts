import activity from 'assets/activity.svg';
import ar from 'assets/ar.svg';
import arconnect from 'assets/arconnect-wallet-logo.png';
import arrow from 'assets/arrow.svg';
import audio from 'assets/audio.svg';
import buy from 'assets/buy.svg';
import close from 'assets/close.svg';
import comments from 'assets/comments.svg';
import html from 'assets/html.svg';
import info from 'assets/info.svg';
import license from 'assets/license.svg';
import logo from 'assets/logo.svg';
import market from 'assets/market.svg';
import orders from 'assets/orders.svg';
import othent from 'assets/othent.svg';
import overview from 'assets/overview.svg';
import provenance from 'assets/provenance.svg';
import renderer from 'assets/renderer.svg';
import sell from 'assets/sell.svg';
import transfer from 'assets/transfer.svg';
import unsupported from 'assets/unsupported.svg';
import user from 'assets/user.svg';
import video from 'assets/video.svg';
import wallet from 'assets/wallet.svg';
import x from 'assets/x.svg';

import { WalletEnum } from './types';

export const PROCESSES = {
	ucm: 'fzRGvSW2oSop9xGLxs5mcaRtCbrbug8imI_uRZHKdiU',
	token: 'IRv02cCZGmBVMhmPlL63sce4djgRgkY1J_3DUl_feUw',
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
	close,
	comments,
	html,
	info,
	license,
	logo,
	market,
	orders,
	othent,
	overview,
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
		max: '1400px',
		tablet: '840px',
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
		avatar: 'Avatar',
		banner: 'Banner',
		dateCreated: 'Date-Created',
		description: 'Description',
		displayName: 'Display-Name',
		handle: 'Handle',
		implements: 'Implements',
		initialOwner: 'Initial-Owner',
		license: 'License',
		profileIndex: 'Profile-Index',
		protocolName: 'Protocol-Name',
		renderWith: 'Render-With',
		thumbnail: 'Thumbnail',
		title: 'Title',
	},
	values: {
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

export const AR_PROFILE = {
	defaultAvatar: 'OrG-ZG2WN3wdcwvpjz1ihPe4MI24QBJUpsJGIdL85wA',
	defaultBanner: 'a0ieiziq2JkYhWamlrUCHxrGYnHWUAMcONxRmfkWt-k',
};

export const CURSORS = {
	p1: 'P1',
	end: 'END',
};

export const PAGINATORS = {
	default: 100,
};

export const REDIRECTS = {
	x: `https://twitter.com/OurBazAR`,
	viewblock: (tx: string) => `https://viewblock.io/arweave/tx/${tx}`,
};
