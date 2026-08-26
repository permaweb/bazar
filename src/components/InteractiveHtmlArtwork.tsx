import React from 'react';

export function InteractiveHtmlArtwork({ name, src }: { name: string; src: string }) {
	return (
		<iframe
			allow="fullscreen"
			allowFullScreen
			className="asset-interactive-frame"
			loading="eager"
			referrerPolicy="no-referrer"
			sandbox="allow-scripts allow-pointer-lock"
			src={src}
			title={`${name} interactive artwork`}
		/>
	);
}
