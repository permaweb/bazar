import React from 'react';

import { transactionExplorerUrl } from 'api/arweave-explorer';

export function TxAddress({ address }: { address: string; wrap?: boolean; tooltipPosition?: string }) {
	return (
		<a href={transactionExplorerUrl(address)} target="_blank" rel="noreferrer" title={address}>
			{address.slice(0, 7)}…{address.slice(-6)}
		</a>
	);
}
