import * as S from './styles';

type TokenAvatarProps = {
	ticker: string;
	className?: string;
	image?: string;
	fetchPriority?: 'high' | 'low' | 'auto';
	loading?: 'eager' | 'lazy';
};

export default function TokenAvatar(props: TokenAvatarProps) {
	const visibleTicker = props.ticker.trim().slice(0, 8) || 'TOKEN';
	const tickerLabel = <strong>{visibleTicker}</strong>;

	return (
		<S.Avatar
			className={`token-avatar ticker-${visibleTicker.length}${visibleTicker.length > 5 ? ' ticker-long' : ''}${
				props.className ?? '' ? ` ${props.className ?? ''}` : ''
			}`}
			aria-hidden="true"
		>
			{props.image ? (
				<S.Image
					alt=""
					className="token-avatar-image"
					fallback={tickerLabel}
					fetchPriority={props.fetchPriority}
					loading={props.loading ?? 'lazy'}
					src={props.image}
				/>
			) : (
				tickerLabel
			)}
		</S.Avatar>
	);
}
