import React from 'react';

import * as S from './styles';

type NameArtworkStyle = React.CSSProperties & {
	'--name-artwork-size': string;
};

export function nameArtworkFontScale(name: string) {
	const length = Math.max(1, Array.from(name.trim()).length);
	return Math.min(28, Math.max(6.5, 120 / length));
}

export default function NameArtwork(props: { name: string; className?: string }) {
	const displayName = props.name.trim() || '—';
	const style: NameArtworkStyle = {
		'--name-artwork-size': `${nameArtworkFontScale(displayName)}cqw`,
	};

	return (
		<S.Artwork
			aria-hidden="true"
			className={`name-asset-artwork${props.className ?? '' ? ` ${props.className ?? ''}` : ''}`}
			style={style}
		>
			<strong>{displayName}</strong>
		</S.Artwork>
	);
}
