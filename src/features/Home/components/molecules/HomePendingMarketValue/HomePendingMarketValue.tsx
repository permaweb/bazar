import { LoaderCircle } from 'lucide-react';

export default function HomePendingMarketValue(props: { label?: string }) {
	return (
		<span className="home-market-value-pending">
			<LoaderCircle aria-hidden="true" />
			<span>{props.label ?? 'Checking…'}</span>
		</span>
	);
}
