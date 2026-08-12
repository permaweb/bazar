import { ArtworkImage } from 'components/ArtworkImage';

type TokenAvatarProps = {
	ticker: string;
	className?: string;
	image?: string;
	fetchPriority?: 'high' | 'low' | 'auto';
	loading?: 'eager' | 'lazy';
};

export function TokenAvatar({ ticker, className = '', image, fetchPriority, loading = 'lazy' }: TokenAvatarProps) {
	const visibleTicker = ticker.trim().slice(0, 8) || 'TOKEN';
	const tickerLabel = <strong>{visibleTicker}</strong>;
	const artwork = image;

	return (
		<span
			className={`token-avatar ticker-${visibleTicker.length}${visibleTicker.length > 5 ? ' ticker-long' : ''}${
				className ? ` ${className}` : ''
			}`}
			aria-hidden="true"
		>
			{artwork ? (
				<ArtworkImage
					alt=""
					className="token-avatar-image"
					fallback={tickerLabel}
					fetchPriority={fetchPriority}
					loading={loading}
					src={artwork}
				/>
			) : (
				tickerLabel
			)}
		</span>
	);
}
