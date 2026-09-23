import { Check } from 'lucide-react';

import type { PurchaseState } from 'api/transactions';

import { useMessages, usePlural } from 'providers/LanguageProvider';

import { ASSET_DETAIL_MESSAGES } from '../../../messages';
import { fungiblePurchaseSequence } from '../../../model/fungible-operation';

export default function FungiblePurchaseSequence(props: {
	states: Array<PurchaseState | undefined>;
	listingCount: number;
}) {
	const messages = useMessages(ASSET_DETAIL_MESSAGES);
	const plural = usePlural();
	const steps = fungiblePurchaseSequence(props.states, props.listingCount, messages, plural);
	return (
		<section aria-label={messages.sequenceLabel} className="purchase-sequence">
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
