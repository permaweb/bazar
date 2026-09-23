import React from 'react';

import { Button } from '../../atoms/Button';

// A dismiss handler without its label would render an unnamed control, so the caller supplies both or neither.
export type StatusNoticeProps = {
	children: React.ReactNode;
	actions?: React.ReactNode;
	className?: string;
} & ({ onDismiss: () => void; dismissLabel: string } | { onDismiss?: never; dismissLabel?: never });

// Persistent status message with optional follow-up actions (resume, review) and an optional dismiss.
export default function StatusNotice(props: StatusNoticeProps) {
	return (
		<div className={props.className ? `pending-operation-notice ${props.className}` : 'pending-operation-notice'}>
			<span role="status">{props.children}</span>
			{props.actions}
			{props.onDismiss ? (
				<Button type="button" onClick={props.onDismiss} size="custom">
					{props.dismissLabel}
				</Button>
			) : null}
		</div>
	);
}
