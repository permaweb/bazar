import React from 'react';

import { ArCurrencyText } from './ArCurrencyLabel';

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
			{active ? <ArCurrencyText>{`${title}. ${detail}`}</ArCurrencyText> : ''}
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
			<h3>
				<ArCurrencyText>{title}</ArCurrencyText>
			</h3>
			{children}
			<p>
				<ArCurrencyText>{detail}</ArCurrencyText>
			</p>
		</div>
	);
}
