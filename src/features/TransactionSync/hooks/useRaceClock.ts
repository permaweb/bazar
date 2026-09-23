import React from 'react';

const RACE_CLOCK_INTERVAL_MS = 250;

/** A 250 ms wall clock that runs only while `active` and the document is visible. */
export function useRaceClock(active: boolean): number {
	const [now, setNow] = React.useState(() => Date.now());

	React.useEffect(() => {
		if (!active) return undefined;
		let interval: number | undefined;
		const stop = () => {
			if (interval !== undefined) window.clearInterval(interval);
			interval = undefined;
		};
		const start = () => {
			stop();
			if (document.hidden) return;
			setNow(Date.now());
			interval = window.setInterval(() => setNow(Date.now()), RACE_CLOCK_INTERVAL_MS);
		};

		start();
		document.addEventListener('visibilitychange', start);
		return () => {
			stop();
			document.removeEventListener('visibilitychange', start);
		};
	}, [active]);

	return now;
}
