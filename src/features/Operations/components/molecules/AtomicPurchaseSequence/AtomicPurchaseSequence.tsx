import { Check } from 'lucide-react';

import type { PurchaseState } from 'api/transactions';

import { atomicPurchaseSequence } from '../../../model/atomic-operation';

export default function AtomicPurchaseSequence(props: { state: PurchaseState | null }) {
	const steps = atomicPurchaseSequence(props.state);
	return (
		<section aria-label="Asset purchase transaction sequence" className="purchase-sequence">
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
