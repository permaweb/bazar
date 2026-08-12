import React from 'react';
import { Server } from 'lucide-react';

import { Tooltip } from 'components/Tooltip';

export function stateVerificationTimeLabel(verifiedAt: number) {
	const timestamp = new Date(verifiedAt);
	const time = timestamp.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
	const date = timestamp.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
	return `${date} at ${time}`;
}

export function StateVerification({
	provider,
	verifiedAt,
	refreshing = false,
	failed = false,
}: {
	provider: string;
	verifiedAt: number | null;
	refreshing?: boolean;
	failed?: boolean;
}) {
	if (!verifiedAt) return null;
	let host = 'selected gateway';
	try {
		host = provider ? new URL(provider).host : host;
	} catch {
		// The state remains identified by its check time if a custom provider label is not a URL.
	}
	const timestamp = new Date(verifiedAt);
	return (
		<p className="state-verification">
			<Server className="ui-icon ui-icon--xs" aria-hidden="true" />
			<span>
				{refreshing ? 'Refreshing · last checked' : failed ? 'Refresh failed · last checked' : 'Checked'}
			</span>{' '}
			<Tooltip content={timestamp.toLocaleString()} placement="top">
				{(tooltipId) => (
					<time aria-describedby={tooltipId} dateTime={timestamp.toISOString()}>
						{stateVerificationTimeLabel(verifiedAt)}
					</time>
				)}
			</Tooltip>{' '}
			<span>via</span>{' '}
			<Tooltip content={provider} placement="top">
				{(tooltipId) => <strong aria-describedby={tooltipId}>{host}</strong>}
			</Tooltip>
			<span>· current state requested</span>
		</p>
	);
}
