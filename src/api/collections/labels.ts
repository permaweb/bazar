import type { Collection } from './adapter';

export function collectionKindLabel(collection: Collection) {
	if (collection.kind === 'names') return 'Arweave identity';
	if (collection.kind === 'tokens') return 'Fungible token collection';
	return 'Permanent artwork collection';
}

export function collectionDisplayName(collection: Collection) {
	return collection.kind === 'tokens' ? 'Tokens' : collection.name;
}

export function collectionEyebrow(collection: Collection) {
	if (collection.kind === 'names') return 'Carrier assets';
	if (collection.kind === 'tokens') return 'Fungible tokens';
	return 'Permanent artwork';
}
