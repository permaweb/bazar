import path from 'node:path';

// Keep the browser build and the Node test runner on the same application entrypoints.
export const SOURCE_LAYERS = [
	'api',
	'apps',
	'assets',
	'components',
	'features',
	'helpers',
	'hooks',
	'navigation',
	'providers',
	'types',
	'views',
] as const;

export const sourceAliases = Object.fromEntries(
	SOURCE_LAYERS.map((layer) => [layer, path.resolve(__dirname, '..', 'src', layer)])
);
