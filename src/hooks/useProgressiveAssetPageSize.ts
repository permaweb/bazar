import React from 'react';

export function useProgressiveAssetPageSize() {
	const query = '(max-width: 480px)';
	const [pageSize, setPageSize] = React.useState(() => (window.matchMedia(query).matches ? 8 : 12));
	React.useEffect(() => {
		const media = window.matchMedia(query);
		const update = () => setPageSize(media.matches ? 8 : 12);
		media.addEventListener('change', update);
		return () => media.removeEventListener('change', update);
	}, []);
	return pageSize;
}
