export function retainedAssetGroupLimit(current: number, pageSize: number) {
	return Math.max(current, pageSize);
}

export function assetGroupRevealComplete(nextLimit: number, resultCount: number) {
	return nextLimit >= resultCount;
}

export function assetGroupRevealAnnouncement(nextLimit: number, resultCount: number, assetLabel: string) {
	return assetGroupRevealComplete(nextLimit, resultCount)
		? `All ${resultCount.toLocaleString()} ${assetLabel} are shown.`
		: `Showing ${nextLimit.toLocaleString()} of ${resultCount.toLocaleString()} ${assetLabel}.`;
}
