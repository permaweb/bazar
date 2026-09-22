import React from 'react';
import { useLocation } from 'react-router-dom';

export function RouteFocus() {
	const { pathname, search } = useLocation();
	const routeKey = `${pathname}${search}`;
	const previousRoute = React.useRef<string | null>(null);
	React.useEffect(() => {
		window.scrollTo({ top: 0, left: 0 });
		const main = document.getElementById('main-content');
		if (!main) return;
		const shouldMoveFocus = previousRoute.current !== null && previousRoute.current !== routeKey;
		previousRoute.current = routeKey;
		let title = 'Bazar — Arweave-native assets';
		let observer: MutationObserver | null = null;
		const updateRouteContext = () => {
			const heading = main.querySelector('h1');
			const headingText = heading?.textContent?.trim();
			if (headingText) {
				title = `${headingText} — Bazar`;
				observer?.disconnect();
			}
			document.title = title;
		};
		const focusFrame = window.requestAnimationFrame(() => {
			updateRouteContext();
			if (shouldMoveFocus) main.focus({ preventScroll: true });
		});
		observer = new MutationObserver(updateRouteContext);
		observer.observe(main, { characterData: true, childList: true, subtree: true });
		return () => {
			window.cancelAnimationFrame(focusFrame);
			observer?.disconnect();
		};
	}, [routeKey]);
	return null;
}
