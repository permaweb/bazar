import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';

import { URLS } from 'helpers/config';
const Asset = getLazyImport('Asset');
const Landing = getLazyImport('Landing');
const Campaign = getLazyImport('Campaign_2');
const Collection = getLazyImport('Collection');
const Collections = getLazyImport('Collections');
const Profile = getLazyImport('Profile');
const Docs = getLazyImport('Docs');
const NotFound = getLazyImport('NotFound');
const Quests = getLazyImport('Quests');

// import NProgress from 'nprogress';

// import 'nprogress/nprogress.css';

// NProgress.configure({ showSpinner: false, speed: 400, trickleSpeed: 200, minimum: 0.3 });

// const useNProgress = () => {
// 	const location = useLocation();

// 	React.useEffect(() => {
// 		const startNProgress = async () => {
// 			NProgress.start();

// 			const trickle = setInterval(() => {
// 				NProgress.inc(0.05);
// 			}, 200);

// 			await new Promise((resolve) => setTimeout(resolve, 275));

// 			clearInterval(trickle);
// 			NProgress.done();
// 		};

// 		startNProgress();
// 	}, [location]);
// };

export default function _Routes() {
	// useNProgress();

	return (
		<Routes>
			<Route path={URLS.base} element={<Landing />} />
			<Route path={URLS.asset} element={<Asset />} />
			<Route path={`${URLS.asset}:id`} element={<Asset />} />
			<Route path={URLS.collection} element={<Collection />} />
			<Route path={`${URLS.collection}:id`} element={<Collection />} />
			<Route path={`${URLS.collection}:id/:active`} element={<Collection />} />
			<Route path={URLS.collections} element={<Collections />} />
			<Route path={URLS.campaign} element={<Campaign />} />
			<Route path={URLS.profile} element={<Profile />} />
			<Route path={`${URLS.profile}:address`} element={<Profile />} />
			<Route path={`${URLS.profile}:address/:active`} element={<Profile />} />
			<Route path={URLS.quest} element={<Quests />} />
			<Route path={URLS.docs} element={<Docs />} />
			<Route path={`${URLS.docs}:active/*`} element={<Docs />} />
			<Route path={URLS.notFound} element={<NotFound />} />
			<Route path={'*'} element={<NotFound />} />
		</Routes>
	);
}

function getLazyImport(view: string) {
	return lazy(() =>
		import(`../views/${view}/index.tsx`).then((module) => ({
			default: module.default,
		}))
	);
}
