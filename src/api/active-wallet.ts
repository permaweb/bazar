let activeWallet: ArweaveWalletProvider | undefined;

export function getActiveWallet() {
	return activeWallet;
}

export function selectActiveWallet(wallet: ArweaveWalletProvider) {
	activeWallet = wallet;
}

export function clearActiveWallet(wallet?: ArweaveWalletProvider) {
	if (wallet && activeWallet !== wallet) return false;
	activeWallet = undefined;
	return true;
}
