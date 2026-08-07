import type { CSSProperties } from 'react';

type NameArtworkStyle = CSSProperties & {
	'--name-artwork-size': string;
};

export function nameArtworkFontScale(name: string) {
	const length = Math.max(1, Array.from(name.trim()).length);
	return Math.min(28, Math.max(6.5, 120 / length));
}

export function NameArtwork({ name, className = '' }: { name: string; className?: string }) {
	const displayName = name.trim() || '—';
	const style: NameArtworkStyle = {
		'--name-artwork-size': `${nameArtworkFontScale(displayName)}cqw`,
	};

	return (
		<span aria-hidden="true" className={`name-asset-artwork${className ? ` ${className}` : ''}`} style={style}>
			<strong>{displayName}</strong>
		</span>
	);
}
