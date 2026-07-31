export const DEFAULT_GATEWAY = 'https://arweave.net';
export const GATEWAYS = {
	default: { protocol: 'https', host: 'arweave.net' },
};
export const AO_MAINNET = { app1: DEFAULT_GATEWAY };

export function gatewayFromLocation(location: Location = window.location): string {
	const requested = new URLSearchParams(location.search).get('node');
	if (requested) return new URL(requested).origin;
	const labels = location.hostname.split('.');
	const host =
		labels[0]?.length === 52 && labels.length > 2
			? labels.slice(1).join('.')
			: location.hostname;
	if (host === 'localhost' || host === '127.0.0.1') return DEFAULT_GATEWAY;
	return `${location.protocol}//${host}${location.port ? `:${location.port}` : ''}`;
}
