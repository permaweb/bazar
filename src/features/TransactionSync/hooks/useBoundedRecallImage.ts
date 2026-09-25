import React from 'react';

import { type ArweaveRecallContent, fetchBoundedRecallImage } from 'api/mining-telemetry';

import { toAppError } from 'helpers/app-error';
import { type AsyncState, LOADING } from 'helpers/async-state';

/**
 * Loads a recall image of unknown size through a bounded fetch and exposes it as an object URL. Success holds `null`
 * when the content is not a previewable image. The request is aborted and the URL revoked when `content` changes.
 */
export function useBoundedRecallImage(content: ArweaveRecallContent): AsyncState<string | null> {
	const [image, setImage] = React.useState<AsyncState<string | null>>(LOADING);

	React.useEffect(() => {
		const controller = new AbortController();
		let objectUrl: string | undefined;
		setImage(LOADING);
		void fetchBoundedRecallImage(content, controller.signal)
			.then((blob) => {
				if (controller.signal.aborted) return;
				if (!blob) {
					setImage({ status: 'success', data: null });
					return;
				}
				objectUrl = URL.createObjectURL(blob);
				setImage({ status: 'success', data: objectUrl });
			})
			.catch((cause) => {
				// The pin keeps its placeholder; a failed preview never affects transaction tracking.
				if (!controller.signal.aborted) setImage({ status: 'error', error: toAppError(cause, 'unavailable') });
			});
		return () => {
			controller.abort();
			if (objectUrl) URL.revokeObjectURL(objectUrl);
		};
	}, [content]);

	return image;
}
