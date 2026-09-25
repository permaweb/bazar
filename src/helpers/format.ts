export function short(value: string) {
	return `${value.slice(0, 6)}…${value.slice(-5)}`;
}

export function formatBytes(value: number) {
	if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
	return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
