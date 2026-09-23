import { LoaderCircle } from 'lucide-react';

import { useMessages } from 'providers/LanguageProvider';

import { HOME_MESSAGES } from '../../../messages';

export default function HomePendingMarketValue(props: { label?: string }) {
	const messages = useMessages(HOME_MESSAGES);
	return (
		<span className="home-market-value-pending">
			<LoaderCircle aria-hidden="true" />
			<span>{props.label ?? messages.homeChecking}</span>
		</span>
	);
}
