import ar from 'assets/ar.svg';
import arconnect from 'assets/arconnect-wallet-logo.png';
import arrow from 'assets/arrow.svg';
import close from 'assets/close.svg';
import logo from 'assets/logo.svg';
import othent from 'assets/othent.svg';
import pixl from 'assets/pixl.svg';
import u from 'assets/u.svg';
import user from 'assets/user.svg';
import wallet from 'assets/wallet.svg';
import x from 'assets/x.svg';

import { WalletEnum } from './types';

export const APP = {
	name: 'Bazar',
};

export const ASSETS = { ar, arconnect, arrow, close, logo, othent, pixl, u, user, wallet, x };

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
		initial: '1024px',
		max: '1400px',
		tablet: '840px',
		secondary: '540px',
	},
	dimensions: {
		button: {
			height: '32.5px',
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
		displayName: 'Display-Name',
		handle: 'Handle',
		profileIndex: 'Profile-Index',
		protocolName: 'Protocol-Name',
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
};
