import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';

import { Loader } from 'components/atoms/Loader';
import { URLS } from 'helpers/config';

const Asset = getLazyImport('Asset');
const Landing = getLazyImport('Landing');
const Collection = getLazyImport('Collection');
const Collections = getLazyImport('Collections');
const Profile = getLazyImport('Profile');
const Docs = getLazyImport('Docs');
const NotFound = getLazyImport('NotFound');

export default function _Routes() {
	return (
		<Suspense fallback={<Loader />}>
			<Routes>
				<Route path={URLS.base} element={<Landing />} />
				<Route path={URLS.asset} element={<Asset />} />
				<Route path={`${URLS.asset}:id`} element={<Asset />} />
				<Route path={`${URLS.collection}:id`} element={<Collection />} />
				<Route path={URLS.collections} element={<Collections />} />
				<Route path={URLS.profile} element={<Profile />} />
				<Route path={`${URLS.profile}:address`} element={<Profile />} />
				<Route path={`${URLS.profile}:address/:active`} element={<Profile />} />
				<Route path={URLS.docs} element={<Docs />} />
				<Route path={`${URLS.docs}:active/*`} element={<Docs />} />
				<Route path={URLS.notFound} element={<NotFound />} />
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
