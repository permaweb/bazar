type TokenArtworkProps = {
  ticker: string;
  className?: string;
};

export function TokenArtwork({ ticker, className = '' }: TokenArtworkProps) {
  const normalizedTicker = ticker.slice(0, 8).toUpperCase();
  return (
    <span
      className={`token-artwork${normalizedTicker.length > 5 ? ' ticker-long' : ''}${className ? ` ${className}` : ''}`}
      aria-hidden="true"
    >
      <strong>{normalizedTicker}</strong>
      <small>Arweave-native</small>
    </span>
  );
}
