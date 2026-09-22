import { Check } from 'lucide-react';

import type { PurchaseState } from 'api/transactions';

import { fungiblePurchaseSequence } from '../../../model/fungible-operation';

export default function FungiblePurchaseSequence(props: {
	states: Array<PurchaseState | undefined>;
	listingCount: number;
}) {
	const steps = fungiblePurchaseSequence(props.states, props.listingCount);
	return (
		<section aria-label="Purchase transaction sequence" className="purchase-sequence">
			<ol>
				{steps.map((step, index) => (
					<li className={step.state} key={step.key}>
						<span aria-hidden="true" className="purchase-sequence-marker">
							{step.state === 'done' ? <Check /> : index + 1}
						</span>
						<span className="purchase-sequence-copy">
							<strong>{step.label}</strong>
						</span>
					</li>
				))}
			</ol>
		</section>
	);
}
