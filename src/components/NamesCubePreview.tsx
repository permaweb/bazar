import React from 'react';

import arweaveNamesCube from '../assets/arweave-names-cube.gif';
import arweaveNamesCubeStill from '../assets/arweave-names-cube.png';

export function NamesCubePreview() {
	const [hovered, setHovered] = React.useState(false);
	return (
		<span
			className="names-cube-preview"
			aria-hidden="true"
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
		>
			<img src={hovered ? arweaveNamesCube : arweaveNamesCubeStill} alt="" decoding="async" loading="lazy" />
		</span>
	);
}
