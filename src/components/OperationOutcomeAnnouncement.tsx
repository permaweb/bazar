import React from 'react';
import { ArrowUpRight, CircleCheck, TriangleAlert } from 'lucide-react';

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
	status,
	children,
}: React.PropsWithChildren<{ title: string; detail: string; status?: React.ReactNode }>) {
	return (
		<div className="result-outcome">
			<div className="result-status-row">
				<h3 className="result-status-heading">
					<CircleCheck aria-hidden="true" className="result-status-icon ui-icon" />
					<ArCurrencyText>{title}</ArCurrencyText>
				</h3>
				{status ? <span className="result-status-meta">{status}</span> : null}
			</div>
			{children}
			<p>
				<ArCurrencyText>{detail}</ArCurrencyText>
			</p>
		</div>
	);
}

export function OperationErrorAlert({ title, message }: { title: string; message: string }) {
	return (
		<div className="result-alert" role="alert">
			<h3 className="result-status-heading">
				<TriangleAlert aria-hidden="true" className="result-status-icon ui-icon" />
				<ArCurrencyText>{title}</ArCurrencyText>
			</h3>
			<p>
				<ArCurrencyText>{message}</ArCurrencyText>
			</p>
		</div>
	);
}

export function OperationExternalLink({ children }: React.PropsWithChildren) {
	return (
		<span className="operation-external-link-label">
			{children}
			<ArrowUpRight aria-hidden="true" className="ui-icon ui-icon--xs" />
		</span>
	);
}

export function OperationOutcomeSubject({
	label,
	title,
	detail,
	media,
}: {
	label: string;
	title: string;
	detail?: string;
	media?: React.ReactNode;
}) {
	return (
		<div className="operation-outcome-subject">
			{media ? <div className="operation-outcome-subject-media">{media}</div> : null}
			<div className="operation-outcome-subject-copy">
				<span>{label}</span>
				<strong>
					<ArCurrencyText>{title}</ArCurrencyText>
				</strong>
				{detail ? (
					<small>
						<ArCurrencyText>{detail}</ArCurrencyText>
					</small>
				) : null}
			</div>
		</div>
	);
}
