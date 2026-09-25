import React from 'react';

import { StatusNotice } from 'components/molecules/StatusNotice';
import { PausedRecoveryNotice, UnavailableOperationRecoveryNotice } from 'features/Operations';
import { useMessages } from 'providers/LanguageProvider';

import type { FungibleOperationActivities } from '../../../hooks/useFungibleOperationActivities';
import { ASSET_DETAIL_MESSAGES } from '../../../messages';

export default function FungibleRecoveryNotices(props: {
	activities: FungibleOperationActivities;
	resumeButtonRef: React.RefObject<HTMLButtonElement>;
	onRefresh(): void;
}) {
	const messages = useMessages(ASSET_DETAIL_MESSAGES);
	return (
		<>
			{props.activities.recoverySuppressed ? (
				<PausedRecoveryNotice
					onResume={props.activities.resumeRecovery}
					resumeButtonRef={props.resumeButtonRef}
				/>
			) : null}
			{props.activities.recoveryNotice ? (
				<StatusNotice
					dismissLabel={messages.assetDetailNoticeDismiss}
					onDismiss={props.activities.dismissRecoveryNotice}
				>
					{props.activities.recoveryNotice}
				</StatusNotice>
			) : null}
			{props.activities.unavailableRecovery ? (
				<UnavailableOperationRecoveryNotice
					recovery={props.activities.unavailableRecovery}
					stateNoun={messages.fungibleRecoveryStateNoun}
					onRefresh={props.onRefresh}
					onDiscard={props.activities.discardUnavailableRecovery}
				/>
			) : null}
		</>
	);
}
