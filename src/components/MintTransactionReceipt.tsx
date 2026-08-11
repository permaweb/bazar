import React from 'react';
import { ArrowUpRight, Check, Copy } from 'lucide-react';

import { transactionExplorerUrl } from 'api/arweave-explorer';

export type MintTransactionReceiptEntry = {
	label: string;
	transactionId: string;
};

export function shortTransactionId(transactionId: string) {
	return `${transactionId.slice(0, 6)}…${transactionId.slice(-6)}`;
}

export function MintTransactionReceipt({ entries }: { entries: MintTransactionReceiptEntry[] }) {
	const [copied, setCopied] = React.useState('');
	return (
		<div className="mint-transaction-receipts" aria-label="Arweave transaction receipts">
			{entries.map(({ label, transactionId }) => (
				<div className="mint-transaction-receipt" key={`${label}:${transactionId}`}>
					<a
						href={transactionExplorerUrl(transactionId)}
						target="_blank"
						rel="noreferrer"
						aria-label={`${label} transaction ${transactionId} on ViewBlock`}
					>
						<span>{label}</span>
						<ArrowUpRight aria-hidden="true" />
					</a>
					<code>{transactionId}</code>
					<button
						type="button"
						aria-label={`Copy ${label.toLowerCase()} transaction ID`}
						onClick={() => {
							void navigator.clipboard.writeText(transactionId).then(() => setCopied(transactionId));
						}}
					>
						{copied === transactionId ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
						<span>{copied === transactionId ? 'Copied' : 'Copy ID'}</span>
					</button>
				</div>
			))}
		</div>
	);
}
