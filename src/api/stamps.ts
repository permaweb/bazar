import Stamps from '@permaweb/stampjs';

import { StampsType } from 'helpers/types';

const stamps = Stamps.init({ process: 'I6h4GTXBECKaZUv3j8-CsFUZ2PdCSXQj9zUh1XkTQk0' });

export async function getStamps(args: { ids: string[] }): Promise<StampsType> {
	const counts = await stamps.counts(args.ids);
	const keys = Object.keys(counts);
	const res = {};
	for (let i = 0; i < keys.length; i++) {
		res[keys[i]] = {
			total: counts[keys[i]].total,
			vouched: counts[keys[i]].vouched,
		};
	}
	return res;
}

export async function stamp(txId) {
	return await stamps.stamp(txId);
}

export async function hasStamped(txId) {
	return await stamps.hasStamped(txId);
}

export async function count(txId) {
	return await stamps.count(txId);
}
