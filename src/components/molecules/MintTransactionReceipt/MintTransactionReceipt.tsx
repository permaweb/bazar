import { ArrowUpRight } from 'lucide-react';

import { transactionExplorerUrl } from 'helpers/explorer';

import { TxAddress, type TxAddressLabels } from '../../atoms/TxAddress';

export type MintTransactionReceiptEntry = {
	label: string;
	/** The link's accessible name, already resolved and interpolated by the feature that owns the copy. */
	linkLabel: string;
	transactionId: string;
};

export function shortTransactionId(transactionId: string) {
	return `${transactionId.slice(0, 6)}…${transactionId.slice(-6)}`;
}

export default function MintTransactionReceipt(props: {
	addressLabels: TxAddressLabels;
	ariaLabel: string;
	entries: MintTransactionReceiptEntry[];
}) {
	return (
		<div className="mint-transaction-receipts" aria-label={props.ariaLabel}>
			{props.entries.map((entry) => (
				<div className="mint-transaction-receipt" key={`${entry.label}:${entry.transactionId}`}>
					<a
						href={transactionExplorerUrl(entry.transactionId)}
						target="_blank"
						rel="noreferrer"
						aria-label={entry.linkLabel}
					>
						<span>{entry.label}</span>
						<ArrowUpRight aria-hidden="true" />
					</a>
					<TxAddress address={entry.transactionId} labels={props.addressLabels} wrap />
				</div>
			))}
		</div>
	);
}
