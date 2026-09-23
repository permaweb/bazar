import React from 'react';

import { LiveRegion } from 'components/atoms/LiveRegion';
import { Loading } from 'components/atoms/Loading';
import { type ArweaveSyncStep, LazyArweaveTransactionSync } from 'features/TransactionSync';

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
	return (
		<>
			{!props.steps.length ? (
				<div className="operation-preparing">
					<Loading
						label={
							props.recovering
								? 'Recovering the signed transaction…'
								: 'Preparing secure wallet approvals…'
						}
					/>
					<p>
						{props.purchase
							? 'Bazar may contact observer nodes while preparing the reservation and seller payment, but no transaction is submitted until its signing step completes.'
							: 'Bazar is preparing the Arweave transaction. The network view will appear as soon as the signed transaction is recoverable.'}
					</p>
				</div>
			) : null}
			{props.observable ? (
				<div className="operation-working">
					<LiveRegion as="p">
						{props.status ||
							'Watching independently addressed Arweave nodes report confirmations for this action.'}
					</LiveRegion>
					<React.Suspense fallback={<Loading label="Loading transaction progress…" />}>
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
