import React from 'react';

import { Button } from '../../atoms/Button';

// Persistent status message with optional follow-up actions (resume, review) and an optional dismiss.
export default function StatusNotice(props: {
	children: React.ReactNode;
	actions?: React.ReactNode;
	onDismiss?: () => void;
	dismissLabel?: string;
	className?: string;
}) {
	return (
		<div className={props.className ? `pending-operation-notice ${props.className}` : 'pending-operation-notice'}>
			<span role="status">{props.children}</span>
			{props.actions}
			{props.onDismiss ? (
				<Button type="button" onClick={props.onDismiss} size="custom">
					{props.dismissLabel ?? 'Dismiss'}
				</Button>
			) : null}
		</div>
	);
}
