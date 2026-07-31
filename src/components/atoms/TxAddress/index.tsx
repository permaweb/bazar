import React from 'react';

export function TxAddress({ address }: { address: string; wrap?: boolean; tooltipPosition?: string }) {
	return (
		<a href={`https://arweave.net/${address}`} target="_blank" rel="noreferrer" title={address}>
			{address.slice(0, 7)}…{address.slice(-6)}
		</a>
	);
}
