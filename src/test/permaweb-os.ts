import { setAoWalletConnection } from 'helpers/config';

/** Model a restored PermawebOS session in transport and policy tests. */
export function connectPermawebOsTestWallet() {
	const wallet: ArweaveWalletProvider = {
		connect: async () => undefined,
		sign: async () => undefined,
	};
	window.arweaveWallet = wallet;
	window.permawebConnect = wallet;
	setAoWalletConnection('a'.repeat(43));
}
