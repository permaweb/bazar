import { ArrowUpRight } from 'lucide-react';

import { transactionExplorerUrl } from 'api/arweave-explorer';

import { TxAddress } from 'components/atoms/TxAddress';

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
				<div className="mint-transaction-receipt" key={`${label}:${transactionId}`}>
					<a
						href={transactionExplorerUrl(transactionId)}
						target="_blank"
						rel="noreferrer"
						aria-label={`${label} transaction ${transactionId} on Lunar`}
					>
						<span>{label}</span>
						<ArrowUpRight aria-hidden="true" />
					</a>
					<TxAddress address={transactionId} wrap />
				</div>
			))}
		</div>
	);
}
