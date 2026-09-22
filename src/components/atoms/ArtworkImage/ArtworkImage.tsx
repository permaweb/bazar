import React from 'react';
import { ImageOff } from 'lucide-react';

import { aoRoutingScopeFromLocation, arweaveDataFallbackUrls } from 'helpers/config';
import { omitProps } from 'helpers/props';

type Props = Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'onError' | 'onLoad'> & {
	src: string;
	fallback?: React.ReactNode;
};

export default function ArtworkImage(props: Props) {
	const [status, setStatus] = React.useState<'loading' | 'loaded' | 'error'>('loading');
	const [sourceIndex, setSourceIndex] = React.useState(0);
	const routingScope = aoRoutingScopeFromLocation();
	const sources = React.useMemo(() => arweaveDataFallbackUrls(props.src), [routingScope, props.src]);

	React.useEffect(() => {
		setSourceIndex(0);
		setStatus('loading');
	}, [routingScope, props.src]);

	if (status === 'error') {
		if (props.fallback) return <>{props.fallback}</>;
		return (
			<span
				aria-hidden={props.alt ?? '' ? undefined : 'true'}
				aria-label={(props.alt ?? '') || undefined}
				className={`artwork-fallback${props.className ?? '' ? ` ${props.className ?? ''}` : ''}`}
				role={props.alt ?? '' ? 'img' : undefined}
			>
				<ImageOff aria-hidden="true" />
				<small>Artwork unavailable</small>
			</span>
		);
	}

	return (
		<img
			{...omitProps(props, ['alt', 'className', 'decoding', 'fallback', 'fetchPriority', 'loading', 'src'])}
			{...(props.fetchPriority ? { fetchpriority: props.fetchPriority } : {})}
			alt={props.alt ?? ''}
			className={`artwork-image is-${status}${props.className ?? '' ? ` ${props.className ?? ''}` : ''}`}
			decoding={props.decoding ?? 'async'}
			loading={props.loading ?? 'lazy'}
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
