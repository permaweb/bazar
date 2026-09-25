import { Music2 } from 'lucide-react';

import { audioFormatLabel } from 'helpers/asset-media';

import * as S from './styles';

// An atom may not read the language provider, so the caller resolves both labels from its own catalog.
export default function AudioArtwork(props: {
	className?: string;
	contentType?: string;
	label: string;
	typeLabel: string;
}) {
	return (
		<S.Artwork
			aria-label={props.label}
			className={`audio-artwork${props.className ?? '' ? ` ${props.className ?? ''}` : ''}`}
			role="img"
		>
			<Music2 aria-hidden="true" />
			<strong>{props.typeLabel}</strong>
			<small>{audioFormatLabel(props.contentType)}</small>
		</S.Artwork>
	);
}
