import React from 'react';
import { Check, CircleAlert, Copy } from 'lucide-react';

import { Button } from './Button';
import { ProfileIdentityForAddress } from './ProfileIdentity';
import { Tooltip } from './Tooltip';

export function WalletAddress({
	address,
	className = '',
	full = false,
	label = 'wallet',
}: {
	address: string;
	className?: string;
	full?: boolean;
	label?: string;
}) {
	const [copyState, setCopyState] = React.useState<'idle' | 'copied' | 'failed'>('idle');
	const resetTimer = React.useRef<number | null>(null);
	React.useEffect(
		() => () => {
			if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
		},
		[]
	);

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(address);
			setCopyState('copied');
		} catch {
			setCopyState('failed');
		}
		if (resetTimer.current !== null) window.clearTimeout(resetTimer.current);
		resetTimer.current = window.setTimeout(() => setCopyState('idle'), 2000);
	};

	return (
		<>
			<span
				className={`wallet-address${full ? ' is-full' : ''}${copyState === 'failed' ? ' is-failed' : ''}${
					className ? ` ${className}` : ''
				}`}
			>
				{full ? <span>{address}</span> : <ProfileIdentityForAddress address={address} />}
				<Tooltip className="wallet-address-tooltip" content={`Copy ${label} address`} placement="top">
					{(tooltipId) => (
						<Button
							aria-describedby={tooltipId}
							aria-label={`Copy ${label} address ${address}`}
							className="wallet-address-copy"
							onClick={() => void copy()}
							size="custom"
							variant="ghost"
						>
							{copyState === 'copied' ? (
								<Check className="ui-icon ui-icon--xs" aria-hidden="true" />
							) : copyState === 'failed' ? (
								<>
									<small>Copy failed</small>
									<CircleAlert className="ui-icon ui-icon--xs" aria-hidden="true" />
								</>
							) : (
								<Copy className="ui-icon ui-icon--xs" aria-hidden="true" />
							)}
						</Button>
					)}
				</Tooltip>
			</span>
			<span className="sr-only" aria-live="polite" role="status">
				{copyState === 'copied'
					? `${label} address copied.`
					: copyState === 'failed'
					? `Could not copy ${label} address.`
					: ''}
			</span>
		</>
	);
}

export function WalletIdentity({ address }: { address: string }) {
	return (
		<Tooltip content={address} placement="top">
			{(tooltipId) => (
				<span aria-describedby={tooltipId} className="wallet-identity">
					{address}
				</span>
			)}
		</Tooltip>
	);
}
