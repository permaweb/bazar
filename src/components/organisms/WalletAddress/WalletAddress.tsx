import React from 'react';
import { Check, CircleAlert, Copy } from 'lucide-react';

import { formatMessage } from 'helpers/i18n';
import { useMessages } from 'providers/LanguageProvider';

import { Button } from '../../atoms/Button';
import { Icon } from '../../atoms/Icon';
import { LiveRegion } from '../../atoms/LiveRegion';
import { Tooltip } from '../../atoms/Tooltip';
import { ProfileIdentityForAddress } from '../ProfileIdentityForAddress';

import { WALLET_ADDRESS_MESSAGES } from './messages';

export default function WalletAddress(props: {
	address: string;
	className?: string;
	full?: boolean;
	label: string;
	tooltipEscapesOverflow?: boolean;
}) {
	const messages = useMessages(WALLET_ADDRESS_MESSAGES);
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
			await navigator.clipboard.writeText(props.address);
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
				className={`wallet-address${props.full ?? false ? ' is-full' : ''}${
					copyState === 'failed' ? ' is-failed' : ''
				}${props.className ?? '' ? ` ${props.className ?? ''}` : ''}`}
			>
				{props.full ?? false ? (
					<span>{props.address}</span>
				) : (
					<ProfileIdentityForAddress address={props.address} />
				)}
				<Tooltip
					className="wallet-address-tooltip"
					content={props.address}
					escapeOverflow={props.tooltipEscapesOverflow ?? false}
					placement="top"
				>
					{(tooltipId) => (
						<Button
							aria-describedby={tooltipId}
							aria-label={formatMessage(messages.walletAddressCopy, {
								address: props.address,
								label: props.label,
							})}
							className="wallet-address-copy"
							onClick={() => void copy()}
							size="custom"
							variant="ghost"
						>
							{copyState === 'copied' ? (
								<Icon icon={Check} size="xs" />
							) : copyState === 'failed' ? (
								<>
									<small>{messages.walletAddressCopyFailed}</small>
									<Icon icon={CircleAlert} size="xs" />
								</>
							) : (
								<Icon icon={Copy} size="xs" />
							)}
						</Button>
					)}
				</Tooltip>
			</span>
			<LiveRegion>
				{copyState === 'copied'
					? formatMessage(messages.walletAddressCopied, { label: props.label })
					: copyState === 'failed'
					? formatMessage(messages.walletAddressCopyFailedAnnouncement, { label: props.label })
					: ''}
			</LiveRegion>
		</>
	);
}

export function WalletIdentity(props: { address: string }) {
	return (
		<Tooltip content={props.address} placement="top">
			{(tooltipId) => (
				<span aria-describedby={tooltipId} className="wallet-identity">
					{props.address}
				</span>
			)}
		</Tooltip>
	);
}
