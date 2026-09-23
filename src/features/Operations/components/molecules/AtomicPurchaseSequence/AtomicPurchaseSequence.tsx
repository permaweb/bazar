import { Check } from 'lucide-react';

import type { PurchaseState } from 'api/transactions';

import { useMessages } from 'providers/LanguageProvider';

import { OPERATIONS_MESSAGES, type OperationsMessages } from '../../../messages';
import { atomicPurchaseSequence, type AtomicPurchaseSequenceStep } from '../../../model/atomic-operation';

const STEP_LABEL_KEYS: Record<AtomicPurchaseSequenceStep['key'], keyof OperationsMessages> = {
	sign: 'purchaseStepSign',
	reserve: 'purchaseStepReserve',
	pay: 'purchaseStepPay',
	verify: 'purchaseStepVerify',
};

export default function AtomicPurchaseSequence(props: { state: PurchaseState | null }) {
	const messages = useMessages(OPERATIONS_MESSAGES);
	const steps = atomicPurchaseSequence(props.state);
	return (
		<section aria-label={messages.purchaseSequenceLabel} className="purchase-sequence">
			<ol>
				{steps.map((step, index) => (
					<li className={step.state} key={step.key}>
						<span aria-hidden="true" className="purchase-sequence-marker">
							{step.state === 'done' ? <Check /> : index + 1}
						</span>
						<span className="purchase-sequence-copy">
							<strong>{messages[STEP_LABEL_KEYS[step.key]]}</strong>
						</span>
					</li>
				))}
			</ol>
		</section>
	);
}
