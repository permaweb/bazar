import React from 'react';

import { LiveRegion } from 'components/atoms/LiveRegion';
import { Loading } from 'components/atoms/Loading';
import { type ArweaveSyncStep, LazyArweaveTransactionSync } from 'features/TransactionSync';
import { useMessages } from 'providers/LanguageProvider';

import { OPERATIONS_MESSAGES } from '../../../messages';

// Preparation and network observation of a signed atomic operation while it is working.
export default function AtomicOperationProgress(props: {
	purchase: boolean;
	recovering: boolean;
	/** Whether signed work exists that the network view can observe. */
	observable: boolean;
	status: string;
	subject: string;
	active: boolean;
	startedAt: number | undefined;
	steps: ArweaveSyncStep[];
	activeStep: string;
	pendingAfterConfirmation: string | undefined;
	skipKind: 'yolo' | 'skip' | undefined;
	onSkip?: () => void;
}) {
	const messages = useMessages(OPERATIONS_MESSAGES);
	return (
		<>
			{!props.steps.length ? (
				<div className="operation-preparing">
					<Loading label={props.recovering ? messages.progressRecovering : messages.progressPreparing} />
					<p>{props.purchase ? messages.progressPurchaseDetail : messages.progressActionDetail}</p>
				</div>
			) : null}
			{props.observable ? (
				<div className="operation-working">
					<LiveRegion as="p">{props.status || messages.progressObserving}</LiveRegion>
					<React.Suspense fallback={<Loading label={messages.loadingTransactionProgress} />}>
						<LazyArweaveTransactionSync
							active={props.active}
							skipKind={props.skipKind}
							onSkip={props.onSkip}
							subject={props.subject}
							startedAt={props.startedAt}
							steps={props.steps}
							activeStep={props.activeStep}
							pendingAfterConfirmation={props.pendingAfterConfirmation}
						/>
					</React.Suspense>
				</div>
			) : null}
		</>
	);
}
