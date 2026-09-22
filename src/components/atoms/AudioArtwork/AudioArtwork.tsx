import { Music2 } from 'lucide-react';

import { audioFormatLabel } from 'helpers/asset-media';

export default function AudioArtwork(props: { className?: string; contentType?: string; name: string }) {
	return (
		<span
			aria-label={`${props.name} ${audioFormatLabel(props.contentType)} audio`}
			className={`audio-artwork${props.className ?? '' ? ` ${props.className ?? ''}` : ''}`}
			role="img"
		>
			<Music2 aria-hidden="true" />
			<strong>Audio</strong>
			<small>{audioFormatLabel(props.contentType)}</small>
		</span>
	);
}
