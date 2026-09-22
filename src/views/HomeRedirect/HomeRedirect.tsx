import { Navigate, useLocation } from 'react-router-dom';

import { homeRouteSearch, homeTabPath } from 'features/Home';

export default function HomeRedirect() {
	const { search } = useLocation();
	return <Navigate to={{ pathname: homeTabPath('discover'), search: homeRouteSearch(search) }} replace />;
}
