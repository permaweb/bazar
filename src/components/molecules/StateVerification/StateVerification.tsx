import { Server } from 'lucide-react';

import { Icon } from '../../atoms/Icon';
import { Tooltip } from '../../atoms/Tooltip';

import * as S from './styles';

// A molecule may not read the language provider, so the status wording travels with the verification data.
export type StateVerificationLabels = {
	checked: string;
	failed: string;
	fallbackHost: string;
	refreshing: string;
	requested: string;
	via: string;
};

export function stateVerificationTimeLabel(verifiedAt: number) {
	const timestamp = new Date(verifiedAt);
	const time = timestamp.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
	const date = timestamp.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
	return `${date} at ${time}`;
}

export default function StateVerification(props: {
	labels: StateVerificationLabels;
	provider: string;
	verifiedAt: number | null;
	refreshing?: boolean;
	failed?: boolean;
}) {
	if (!props.verifiedAt) return null;
	let host = props.labels.fallbackHost;
	try {
		host = props.provider ? new URL(props.provider).host : host;
	} catch {
		// The state remains identified by its check time if a custom provider label is not a URL.
	}
	const timestamp = new Date(props.verifiedAt);
	const timeLabel = stateVerificationTimeLabel(props.verifiedAt);
	return (
		<S.Verification className="state-verification">
			<Icon icon={Server} size="xs" />
			<span>
				{props.refreshing ?? false
					? props.labels.refreshing
					: props.failed ?? false
					? props.labels.failed
					: props.labels.checked}
			</span>{' '}
			<Tooltip content={timestamp.toLocaleString()} placement="top">
				{(tooltipId) => (
					<time aria-describedby={tooltipId} dateTime={timestamp.toISOString()}>
						{timeLabel}
					</time>
				)}
			</Tooltip>{' '}
			<span>{props.labels.via}</span>{' '}
			<Tooltip content={props.provider} placement="top">
				{(tooltipId) => <strong aria-describedby={tooltipId}>{host}</strong>}
			</Tooltip>
			<span>{props.labels.requested}</span>
		</S.Verification>
	);
}
