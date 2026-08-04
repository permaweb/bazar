const ARWEAVE_EXPLORER = 'https://viewblock.io/arweave';

export function transactionExplorerUrl(transactionId: string) {
  return `${ARWEAVE_EXPLORER}/tx/${encodeURIComponent(transactionId)}`;
}
