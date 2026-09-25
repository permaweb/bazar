import React from 'react';

import type { CollectionActivityEvent } from 'api/discovery';

import { marketActivityRefreshDelay } from '../model/market-activity';

// The clock relative activity timestamps are rendered against. It ticks only at the next boundary where a visible
// label would change, and pauses while the document is hidden.
export function useMarketActivityNow(events: CollectionActivityEvent[]): number {
	const [now, setNow] = React.useState(() => Date.now());
	React.useEffect(() => {
		let timer: number | undefined;
		const schedule = () => {
			window.clearTimeout(timer);
			if (document.visibilityState !== 'visible') return;
			const current = Date.now();
			setNow(current);
			const delay = marketActivityRefreshDelay(events, current);
			if (delay !== null) timer = window.setTimeout(schedule, delay);
		};
		const resume = () => schedule();
		document.addEventListener('visibilitychange', resume);
		schedule();
		return () => {
			window.clearTimeout(timer);
			document.removeEventListener('visibilitychange', resume);
		};
	}, [events]);
	return now;
}
