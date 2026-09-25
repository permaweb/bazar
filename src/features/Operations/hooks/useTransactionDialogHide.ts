import React from 'react';

import {
	prepareTransactionDialogHide,
	TRANSACTION_DIALOG_HIDE_DURATION_MS,
} from 'components/molecules/TransactionDialogControl';

const GLOBAL_ACTIVITY_TRIGGER = '.operation-activity-trigger[data-activity-owner="global"]';

/**
 * Hides a transaction side panel into the global activity control while its work continues: the panel animates
 * toward the control, then `onHide` runs. Showing the panel again cancels the hiding state.
 */
export function useTransactionDialogHide(
	visible: boolean,
	onHide: () => void
): {
	hiding: boolean;
	panelRef: React.MutableRefObject<HTMLElement | null>;
	hide(): void;
} {
	const panelRef = React.useRef<HTMLElement | null>(null);
	const hideTimerRef = React.useRef<number | null>(null);
	const [hiding, setHiding] = React.useState(false);

	React.useEffect(() => {
		if (visible) setHiding(false);
	}, [visible]);
	React.useEffect(
		() => () => {
			if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
		},
		[]
	);

	function hide() {
		if (hiding) return;
		if (panelRef.current) {
			prepareTransactionDialogHide(
				panelRef.current,
				document.querySelector<HTMLElement>(GLOBAL_ACTIVITY_TRIGGER)
			);
		}
		setHiding(true);
		hideTimerRef.current = window.setTimeout(() => {
			hideTimerRef.current = null;
			onHide();
		}, TRANSACTION_DIALOG_HIDE_DURATION_MS);
	}

	return { hiding, panelRef, hide };
}
