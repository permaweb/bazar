const ARWEAVE_EXPLORER = 'https://lunar.arweave.net/#/explorer';

export function transactionExplorerUrl(transactionId: string) {
	return `${ARWEAVE_EXPLORER}/${encodeURIComponent(transactionId)}`;
}
