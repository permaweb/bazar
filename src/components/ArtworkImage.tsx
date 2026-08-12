import React from 'react';
import { ImageOff } from 'lucide-react';

import { arweaveDataFallbackUrls } from 'helpers/config';

type Props = Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'onError' | 'onLoad'> & {
	src: string;
	fallback?: React.ReactNode;
};

export function ArtworkImage({
	alt = '',
	className = '',
	decoding = 'async',
	fallback,
	fetchPriority,
	loading = 'lazy',
	src,
	...props
}: Props) {
	const [status, setStatus] = React.useState<'loading' | 'loaded' | 'error'>('loading');
	const [sourceIndex, setSourceIndex] = React.useState(0);
	const sources = React.useMemo(() => arweaveDataFallbackUrls(src), [src]);

	React.useEffect(() => {
		setSourceIndex(0);
		setStatus('loading');
	}, [src]);

	if (status === 'error') {
		if (fallback) return <>{fallback}</>;
		return (
			<span
				aria-hidden={alt ? undefined : 'true'}
				aria-label={alt || undefined}
				className={`artwork-fallback${className ? ` ${className}` : ''}`}
				role={alt ? 'img' : undefined}
			>
				<ImageOff aria-hidden="true" />
				<small>Artwork unavailable</small>
			</span>
		);
	}

	return (
		<img
			{...props}
			{...(fetchPriority ? { fetchpriority: fetchPriority } : {})}
			alt={alt}
			className={`artwork-image is-${status}${className ? ` ${className}` : ''}`}
			decoding={decoding}
			loading={loading}
			src={sources[sourceIndex]}
			onError={() => {
				if (sourceIndex + 1 < sources.length) {
					setSourceIndex(sourceIndex + 1);
					setStatus('loading');
				} else setStatus('error');
			}}
			onLoad={(event) => {
				const image = event.currentTarget;
				void image
					.decode()
					.catch(() => undefined)
					.then(() => {
						if (image.isConnected) setStatus('loaded');
					});
			}}
		/>
	);
}
