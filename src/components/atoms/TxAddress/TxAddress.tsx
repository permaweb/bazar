import React from 'react';
import { Check, Copy } from 'lucide-react';

import { transactionExplorerUrl } from 'helpers/explorer';

import { Button } from '../Button';
import { Icon } from '../Icon';
import { LiveRegion } from '../LiveRegion';
import { Tooltip } from '../Tooltip';

// The copy control's wording belongs to the caller: an atom may not read the language provider.
export type TxAddressLabels = {
	copy: string;
	copiedTooltip: string;
	copiedLabel: string;
	copiedAnnouncement: string;
};

export default function TxAddress(props: {
	address: string;
	labels: TxAddressLabels;
	wrap?: boolean;
	tooltipPosition?: string;
}) {
	const [copied, setCopied] = React.useState(false);
	const resetTimer = React.useRef<number | null>(null);

	React.useEffect(
		() => () => {
			if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
		},
		[]
	);

	const copyAddress = async () => {
		try {
			await navigator.clipboard.writeText(props.address);
			setCopied(true);
			if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
			resetTimer.current = window.setTimeout(() => setCopied(false), 2000);
		} catch {
			setCopied(false);
		}
	};

	return (
		<span className={`tx-address${props.wrap ?? false ? ' is-wrapped' : ''}`}>
			<Tooltip content={props.address} placement="top">
				{(tooltipId) => (
					<a
						aria-describedby={tooltipId}
						className="tx-address-link"
						href={transactionExplorerUrl(props.address)}
						target="_blank"
						rel="noreferrer"
					>
						{props.wrap ?? false
							? props.address
							: `${props.address.slice(0, 7)}…${props.address.slice(-6)}`}
					</a>
				)}
			</Tooltip>
			<Tooltip content={copied ? props.labels.copiedTooltip : props.labels.copy} placement="top">
				{(tooltipId) => (
					<Button
						aria-describedby={tooltipId}
						aria-label={copied ? props.labels.copiedLabel : props.labels.copy}
						className="tx-address-copy"
						onClick={() => void copyAddress()}
						size="icon"
						variant="ghost"
					>
						{copied ? <Icon icon={Check} size="xs" /> : <Icon icon={Copy} size="xs" />}
					</Button>
				)}
			</Tooltip>
			<LiveRegion>{copied ? props.labels.copiedAnnouncement : ''}</LiveRegion>
		</span>
	);
}
