import React from 'react';

import { Loading } from 'components/atoms/Loading';

const AssetCreator = React.lazy(() => import('features/Create').then((module) => ({ default: module.AssetCreator })));

export default function Create() {
	return (
		<React.Suspense fallback={<Loading label="Loading creator…" />}>
			<AssetCreator />
		</React.Suspense>
	);
}
