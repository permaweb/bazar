import React from 'react';

import { type EstimatedProgress, nextEstimatedProgress } from '../model/syncProgress';

/**
 * Tracks the median observer's progress through the active phase so the progress bar moves between confirmations,
 * and reports each new phase progress to `onProgressChange`.
 */
export function useEstimatedSyncProgress(
	progressKey: string,
	confirmedProgress: number,
	activePhaseProgress: number | undefined,
	onProgressChange: ((progress: number) => void) | undefined
): EstimatedProgress {
	const [estimatedProgress, setEstimatedProgress] = React.useState<EstimatedProgress>({
		key: progressKey,
		value: 0,
	});

	React.useEffect(() => {
		if (activePhaseProgress === undefined) return;
		setEstimatedProgress((current) =>
			nextEstimatedProgress(current, progressKey, confirmedProgress, activePhaseProgress)
		);
		onProgressChange?.(activePhaseProgress);
	}, [activePhaseProgress, confirmedProgress, onProgressChange, progressKey]);

	return estimatedProgress;
}
