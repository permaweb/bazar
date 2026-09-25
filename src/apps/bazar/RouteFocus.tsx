import React from 'react';
import { useLocation } from 'react-router-dom';

import { formatMessage } from 'helpers/i18n';
import { useMessages } from 'providers/LanguageProvider';

import { BAZAR_APP_MESSAGES } from './messages';

export function RouteFocus() {
	const { pathname, search } = useLocation();
	const messages = useMessages(BAZAR_APP_MESSAGES);
	const routeKey = `${pathname}${search}`;
	const previousRoute = React.useRef<string | null>(null);
	React.useEffect(() => {
		window.scrollTo({ top: 0, left: 0 });
		const main = document.getElementById('main-content');
		if (!main) return;
		const shouldMoveFocus = previousRoute.current !== null && previousRoute.current !== routeKey;
		previousRoute.current = routeKey;
		let title = messages.appDocumentTitle;
		let observer: MutationObserver | null = null;
		const updateRouteContext = () => {
			const heading = main.querySelector('h1');
			const headingText = heading?.textContent?.trim();
			if (headingText) {
				title = formatMessage(messages.appRouteDocumentTitle, { heading: headingText });
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
	}, [messages, routeKey]);
	return null;
}
