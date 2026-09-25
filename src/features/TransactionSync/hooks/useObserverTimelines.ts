import React from 'react';

import { nextObserverTimelines, type Timeline } from '../model/observerTimeline';
import type { ArweaveSyncStep } from '../types';

/** Accumulates each step's observer history across renders so earlier responses stay on the timeline. */
export function useObserverTimelines(steps: ArweaveSyncStep[]): Map<string, Timeline> {
	const [timelines, setTimelines] = React.useState<Map<string, Timeline>>(() => new Map());

	React.useEffect(() => {
		setTimelines((current) => nextObserverTimelines(current, steps));
	}, [steps]);

	return timelines;
}
