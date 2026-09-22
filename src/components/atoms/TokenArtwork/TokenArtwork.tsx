type TokenArtworkProps = {
	ticker: string;
	className?: string;
};

export default function TokenArtwork(props: TokenArtworkProps) {
	const visibleTicker = props.ticker.slice(0, 8);
	return (
		<span
			className={`token-artwork ticker-${visibleTicker.length}${visibleTicker.length > 5 ? ' ticker-long' : ''}${
				props.className ?? '' ? ` ${props.className ?? ''}` : ''
			}`}
			aria-hidden="true"
		>
			<strong>{visibleTicker}</strong>
			<small>Arweave-native</small>
		</span>
	);
}
