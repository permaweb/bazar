import React from 'react';

import { arweaveDataUrl } from 'helpers/config';

import arweaveNamesCubeStill from '../assets/arweave-names-cube.png';

const ARWEAVE_NAMES_CUBE_ID = 'V2oaZC7f9ZtAlEISMyLjLzWaVR5ky-Nl1tWdmxePSC4';

export function NamesCubePreview() {
	const [hovered, setHovered] = React.useState(false);
	return (
		<span
			className="names-cube-preview"
			aria-hidden="true"
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
		>
			<img
				src={hovered ? arweaveDataUrl(ARWEAVE_NAMES_CUBE_ID, 'https://arweave.net') : arweaveNamesCubeStill}
				alt=""
				decoding="async"
				loading="lazy"
			/>
		</span>
	);
}
