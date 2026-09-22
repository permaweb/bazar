import React from 'react';
import { ArrowUpRight, CircleCheck, TriangleAlert } from 'lucide-react';

import { ArCurrencyText } from '../../atoms/ArCurrencyLabel';
import { Icon } from '../../atoms/Icon';
import { LiveRegion } from '../../atoms/LiveRegion';

export default function OperationOutcomeAnnouncement(props: { active: boolean; title: string; detail: string }) {
	return (
		<LiveRegion as="div" atomic>
			{props.active ? <ArCurrencyText>{`${props.title}. ${props.detail}`}</ArCurrencyText> : ''}
		</LiveRegion>
	);
}

export function OperationOutcome(
	props: React.PropsWithChildren<{ title: string; detail: string; status?: React.ReactNode }>
) {
	return (
		<div className="result-outcome">
			<div className="result-status-row">
				<h3 className="result-status-heading">
					<Icon icon={CircleCheck} className="result-status-icon" />
					<ArCurrencyText>{props.title}</ArCurrencyText>
				</h3>
				{props.status ? <span className="result-status-meta">{props.status}</span> : null}
			</div>
			{props.children}
			<p>
				<ArCurrencyText>{props.detail}</ArCurrencyText>
			</p>
		</div>
	);
}

export function OperationErrorAlert(props: { title: string; message: string }) {
	return (
		<div className="result-alert" role="alert">
			<h3 className="result-status-heading">
				<Icon icon={TriangleAlert} className="result-status-icon" />
				<ArCurrencyText>{props.title}</ArCurrencyText>
			</h3>
			<p>
				<ArCurrencyText>{props.message}</ArCurrencyText>
			</p>
		</div>
	);
}

export function OperationExternalLink(props: React.PropsWithChildren) {
	return (
		<span className="operation-external-link-label">
			{props.children}
			<Icon icon={ArrowUpRight} size="xs" />
		</span>
	);
}

export function OperationOutcomeSubject(props: {
	label: string;
	title: string;
	detail?: string;
	media?: React.ReactNode;
}) {
	return (
		<div className="operation-outcome-subject">
			{props.media ? <div className="operation-outcome-subject-media">{props.media}</div> : null}
			<div className="operation-outcome-subject-copy">
				<span>{props.label}</span>
				<strong>
					<ArCurrencyText>{props.title}</ArCurrencyText>
				</strong>
				{props.detail ? (
					<small>
						<ArCurrencyText>{props.detail}</ArCurrencyText>
					</small>
				) : null}
			</div>
		</div>
	);
}
