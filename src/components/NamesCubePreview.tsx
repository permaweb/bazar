import React from 'react';

import arweaveNamesCubeStill from '../assets/arweave-names-cube.png';

const arweaveNamesCube = 'https://arweave.net/V2oaZC7f9ZtAlEISMyLjLzWaVR5ky-Nl1tWdmxePSC4';

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
