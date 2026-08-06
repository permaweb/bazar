import React from 'react';

export function OperationOutcomeAnnouncement({
	active,
	title,
	detail,
}: {
	active: boolean;
	title: string;
	detail: string;
}) {
	return (
		<div aria-atomic="true" className="sr-only" role="status">
			{active ? `${title}. ${detail}` : ''}
		</div>
	);
}

export function OperationOutcome({
	title,
	detail,
	children,
}: React.PropsWithChildren<{ title: string; detail: string }>) {
	return (
		<div className="result-outcome">
			<h3>{title}</h3>
			{children}
			<p>{detail}</p>
		</div>
	);
}
