type TokenArtworkProps = {
	ticker: string;
	className?: string;
};

export function TokenArtwork({ ticker, className = '' }: TokenArtworkProps) {
	const visibleTicker = ticker.slice(0, 8);
	return (
		<span
			className={`token-artwork ticker-${visibleTicker.length}${visibleTicker.length > 5 ? ' ticker-long' : ''}${
				className ? ` ${className}` : ''
			}`}
			aria-hidden="true"
		>
			<strong>{visibleTicker}</strong>
			<small>Arweave-native</small>
		</span>
	);
}
