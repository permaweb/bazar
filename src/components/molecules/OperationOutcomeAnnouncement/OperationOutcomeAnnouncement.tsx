import React from 'react';
import { ArrowUpRight, CircleCheck, TriangleAlert } from 'lucide-react';

import { ArCurrencyText } from '../../atoms/ArCurrencyLabel';
import { Icon } from '../../atoms/Icon';
import { LiveRegion } from '../../atoms/LiveRegion';

import * as S from './styles';

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
			<S.StatusRow className="result-status-row">
				<S.StatusHeading className="result-status-heading">
					<S.StatusIcon icon={CircleCheck} className="result-status-icon" />
					<ArCurrencyText>{props.title}</ArCurrencyText>
				</S.StatusHeading>
				{props.status ? <S.StatusMeta className="result-status-meta">{props.status}</S.StatusMeta> : null}
			</S.StatusRow>
			{props.children}
			<p>
				<ArCurrencyText>{props.detail}</ArCurrencyText>
			</p>
		</div>
	);
}

export function OperationErrorAlert(props: { title: string; message: string }) {
	return (
		<S.Alert className="result-alert" role="alert">
			<S.StatusHeading className="result-status-heading">
				<S.StatusIcon icon={TriangleAlert} className="result-status-icon" />
				<ArCurrencyText>{props.title}</ArCurrencyText>
			</S.StatusHeading>
			<p>
				<ArCurrencyText>{props.message}</ArCurrencyText>
			</p>
		</S.Alert>
	);
}

export function OperationExternalLink(props: React.PropsWithChildren) {
	return (
		<S.ExternalLink className="operation-external-link-label">
			{props.children}
			<Icon icon={ArrowUpRight} size="xs" />
		</S.ExternalLink>
	);
}

export function OperationOutcomeSubject(props: {
	label: string;
	title: string;
	detail?: string;
	media?: React.ReactNode;
}) {
	return (
		<S.Subject className="operation-outcome-subject">
			{props.media ? (
				<S.SubjectMedia className="operation-outcome-subject-media">{props.media}</S.SubjectMedia>
			) : null}
			<S.SubjectCopy className="operation-outcome-subject-copy">
				<span>{props.label}</span>
				<strong>
					<ArCurrencyText>{props.title}</ArCurrencyText>
				</strong>
				{props.detail ? (
					<small>
						<ArCurrencyText>{props.detail}</ArCurrencyText>
					</small>
				) : null}
			</S.SubjectCopy>
		</S.Subject>
	);
}
