import { ArrowUpRight } from 'lucide-react';

import { transactionExplorerUrl } from 'api/arweave-explorer';

export type MintTransactionReceiptEntry = {
	label: string;
	transactionId: string;
};

export function shortTransactionId(transactionId: string) {
	return `${transactionId.slice(0, 6)}…${transactionId.slice(-6)}`;
}

export function MintTransactionReceipt({ entries }: { entries: MintTransactionReceiptEntry[] }) {
	return (
		<div className="mint-transaction-receipts" aria-label="Arweave transaction receipts">
			{entries.map(({ label, transactionId }) => (
				<a
					key={`${label}:${transactionId}`}
					href={transactionExplorerUrl(transactionId)}
					target="_blank"
					rel="noreferrer"
					aria-label={`${label} transaction ${transactionId} on ViewBlock`}
				>
					<span>{label}</span>
					<code>{shortTransactionId(transactionId)}</code>
					<ArrowUpRight aria-hidden="true" />
				</a>
			))}
		</div>
	);
}
