import React from 'react';
import { ImageOff } from 'lucide-react';

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

	React.useEffect(() => setStatus('loading'), [src]);

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
			src={src}
			onError={() => setStatus('error')}
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
