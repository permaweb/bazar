import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';

import { Loader } from 'components/atoms/Loader';
import { URLS } from 'helpers/config';

const Landing = getLazyImport('Landing');
const Collections = getLazyImport('Collections');
const Docs = getLazyImport('Docs');
const NotFound = getLazyImport('NotFound');

export default function _Routes() {
	return (
		<Suspense fallback={<Loader />}>
			<Routes>
				<Route path={URLS.base} element={<Landing />} />
				<Route path={URLS.collections} element={<Collections />} />
				<Route path={URLS.docs} element={<Docs />} />
				<Route path={`${URLS.docs}:active/*`} element={<Docs />} />
				<Route path={'*'} element={<NotFound />} />
			</Routes>
		</Suspense>
	);
}

function getLazyImport(view: string) {
	return lazy(() =>
		import(`../views/${view}/index.tsx`).then((module) => ({
			default: module.default,
		}))
	);
}
