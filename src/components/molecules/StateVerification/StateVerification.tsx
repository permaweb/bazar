import { Server } from 'lucide-react';

import { Icon } from '../../atoms/Icon';
import { Tooltip } from '../../atoms/Tooltip';

export function stateVerificationTimeLabel(verifiedAt: number) {
	const timestamp = new Date(verifiedAt);
	const time = timestamp.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
	const date = timestamp.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
	return `${date} at ${time}`;
}

export default function StateVerification(props: {
	provider: string;
	verifiedAt: number | null;
	refreshing?: boolean;
	failed?: boolean;
}) {
	if (!props.verifiedAt) return null;
	let host = 'selected gateway';
	try {
		host = props.provider ? new URL(props.provider).host : host;
	} catch {
		// The state remains identified by its check time if a custom provider label is not a URL.
	}
	const timestamp = new Date(props.verifiedAt);
	const timeLabel = stateVerificationTimeLabel(props.verifiedAt);
	return (
		<p className="state-verification">
			<Icon icon={Server} size="xs" />
			<span>
				{props.refreshing ?? false
					? 'Refreshing · last checked'
					: props.failed ?? false
					? 'Refresh failed · last checked'
					: 'Checked'}
			</span>{' '}
			<Tooltip content={timestamp.toLocaleString()} placement="top">
				{(tooltipId) => (
					<time aria-describedby={tooltipId} dateTime={timestamp.toISOString()}>
						{timeLabel}
					</time>
				)}
			</Tooltip>{' '}
			<span>via</span>{' '}
			<Tooltip content={props.provider} placement="top">
				{(tooltipId) => <strong aria-describedby={tooltipId}>{host}</strong>}
			</Tooltip>
			<span>· current state requested</span>
		</p>
	);
}
