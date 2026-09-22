import { LoaderCircle } from 'lucide-react';

export default function HomeMarketGhostCard(props: { kind: 'collection' }) {
	const collection = props.kind === 'collection';
	return (
		<div
			className={`home-market-ghost home-market-ghost--${props.kind}${collection ? ' home-feature-card' : ''}`}
			role="status"
		>
			<LoaderCircle aria-hidden="true" />
			<strong>{collection ? 'Loading more collections' : 'Loading more assets'}</strong>
			<span>{collection ? 'Checking indexes and live floors.' : 'Checking active listings and prices.'}</span>
		</div>
	);
}
