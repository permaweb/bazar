import { formatMessage } from './i18n';

export function retainedAssetGroupLimit(current: number, pageSize: number) {
	return Math.max(current, pageSize);
}

export function assetGroupRevealComplete(nextLimit: number, resultCount: number) {
	return nextLimit >= resultCount;
}

/** `messages` holds the caller's already-resolved `{shown}`/`{count}`/`{assets}` templates. */
export function assetGroupRevealAnnouncement(
	nextLimit: number,
	resultCount: number,
	assetLabel: string,
	messages: { complete: string; partial: string }
) {
	return assetGroupRevealComplete(nextLimit, resultCount)
		? formatMessage(messages.complete, { count: resultCount.toLocaleString(), assets: assetLabel })
		: formatMessage(messages.partial, {
				shown: nextLimit.toLocaleString(),
				count: resultCount.toLocaleString(),
				assets: assetLabel,
		  });
}
