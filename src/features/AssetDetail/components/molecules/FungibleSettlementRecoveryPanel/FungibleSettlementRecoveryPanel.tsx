import React from 'react';

import { SETTLEMENT_ERROR_PANEL_ID } from '../../../model/fungible-operation';

export default function FungibleSettlementRecoveryPanel(props: {
	children?: React.ReactNode;
	orderId: string;
	settled?: boolean;
}) {
	return (
		<section
			aria-labelledby={`settlement-error-tab-${props.orderId}`}
			className={`settlement-error-detail${props.settled ?? false ? ' settlement-success-detail' : ''}`}
			id={SETTLEMENT_ERROR_PANEL_ID}
			role="tabpanel"
			tabIndex={0}
		>
			{props.children}
		</section>
	);
}
