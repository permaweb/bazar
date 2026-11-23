import React from 'react';
import { Check, CircleAlert, Copy } from 'lucide-react';

import { transactionExplorerUrl } from 'api/arweave-explorer';

import { Button } from 'components/Button';
import { Tooltip } from 'components/Tooltip';

export type TxAddressCopyState = 'idle' | 'copied' | 'failed';

/** Copies text and reports the outcome; never rejects (a missing or denied clipboard is 'failed'). */
export async function copyToClipboard(text: string): Promise<Exclude<TxAddressCopyState, 'idle'>> {
	try {
		await navigator.clipboard.writeText(text);
		return 'copied';
	} catch {
		return 'failed';
	}
}

export const TX_ADDRESS_COPY_LABELS: Record<
	TxAddressCopyState,
	{ tooltip: string; ariaLabel: string; status: string }
> = {
	idle: { tooltip: 'Copy transaction address', ariaLabel: 'Copy transaction address', status: '' },
	copied: { tooltip: 'Copied', ariaLabel: 'Transaction address copied', status: 'Transaction address copied.' },
	failed: {
		tooltip: 'Copy failed',
		ariaLabel: 'Copy failed',
		status: 'Transaction address could not be copied.',
	},
};

export function TxAddress({ address, wrap = false }: { address: string; wrap?: boolean; tooltipPosition?: string }) {
	const [copyState, setCopyState] = React.useState<TxAddressCopyState>('idle');
	const resetTimer = React.useRef<number | null>(null);

	React.useEffect(
		() => () => {
			if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
		},
		[]
	);

	const copyAddress = async () => {
		setCopyState(await copyToClipboard(address));
		if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
		resetTimer.current = window.setTimeout(() => setCopyState('idle'), 2000);
	};

	const labels = TX_ADDRESS_COPY_LABELS[copyState];

	return (
		<span className={`tx-address${wrap ? ' is-wrapped' : ''}`}>
			<Tooltip content={address} placement="top">
				{(tooltipId) => (
					<a
						aria-describedby={tooltipId}
						className="tx-address-link"
						href={transactionExplorerUrl(address)}
						target="_blank"
						rel="noreferrer"
					>
						{wrap ? address : `${address.slice(0, 7)}…${address.slice(-6)}`}
					</a>
				)}
			</Tooltip>
			<Tooltip content={labels.tooltip} placement="top">
				{(tooltipId) => (
					<Button
						aria-describedby={tooltipId}
						aria-label={labels.ariaLabel}
						className="tx-address-copy"
						onClick={() => void copyAddress()}
						size="icon"
						variant="ghost"
					>
						{copyState === 'copied' ? (
							<Check className="ui-icon ui-icon--xs" aria-hidden="true" />
						) : copyState === 'failed' ? (
							<CircleAlert className="ui-icon ui-icon--xs" aria-hidden="true" />
						) : (
							<Copy className="ui-icon ui-icon--xs" aria-hidden="true" />
						)}
					</Button>
				)}
			</Tooltip>
			<span className="sr-only" aria-live="polite" role="status">
				{labels.status}
			</span>
		</span>
	);
}
