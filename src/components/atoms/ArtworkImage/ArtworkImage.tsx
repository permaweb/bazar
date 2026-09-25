import React from 'react';
import { ImageOff } from 'lucide-react';

import { aoRoutingScopeFromLocation, arweaveDataFallbackUrls } from 'helpers/config';
import { omitProps } from 'helpers/props';

import * as S from './styles';

// A caller either supplies its own error fallback or the copy the built-in fallback announces; it may not
// leave the error state without either.
export type ArtworkImageProps = Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'onError' | 'onLoad'> & {
	src: string;
} & ({ fallback: React.ReactNode; unavailableLabel?: never } | { fallback?: never; unavailableLabel: string });

export default function ArtworkImage(props: ArtworkImageProps) {
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
			<S.Fallback
				aria-hidden={props.alt ?? '' ? undefined : 'true'}
				aria-label={(props.alt ?? '') || undefined}
				className={`artwork-fallback${props.className ?? '' ? ` ${props.className ?? ''}` : ''}`}
				role={props.alt ?? '' ? 'img' : undefined}
			>
				<ImageOff aria-hidden="true" />
				<small>{props.unavailableLabel}</small>
			</S.Fallback>
		);
	}

	return (
		<S.Image
			{...omitProps(props, [
				'alt',
				'className',
				'decoding',
				'fallback',
				'fetchPriority',
				'loading',
				'src',
				'unavailableLabel',
			])}
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
