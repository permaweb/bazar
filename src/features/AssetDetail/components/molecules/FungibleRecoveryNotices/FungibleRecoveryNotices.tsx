import React from 'react';

import { StatusNotice } from 'components/molecules/StatusNotice';
import { PausedRecoveryNotice, UnavailableOperationRecoveryNotice } from 'features/Operations';

import type { FungibleOperationActivities } from '../../../hooks/useFungibleOperationActivities';

export default function FungibleRecoveryNotices(props: {
	activities: FungibleOperationActivities;
	resumeButtonRef: React.RefObject<HTMLButtonElement>;
	onRefresh(): void;
}) {
	return (
		<>
			{props.activities.recoverySuppressed ? (
				<PausedRecoveryNotice
					onResume={props.activities.resumeRecovery}
					resumeButtonRef={props.resumeButtonRef}
				/>
			) : null}
			{props.activities.recoveryNotice ? (
				<StatusNotice onDismiss={props.activities.dismissRecoveryNotice}>
					{props.activities.recoveryNotice}
				</StatusNotice>
			) : null}
			{props.activities.unavailableRecovery ? (
				<UnavailableOperationRecoveryNotice
					recovery={props.activities.unavailableRecovery}
					stateNoun="balances and orders above"
					onRefresh={props.onRefresh}
					onDiscard={props.activities.discardUnavailableRecovery}
				/>
			) : null}
		</>
	);
}
