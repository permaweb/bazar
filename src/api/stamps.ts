import Stamps from '@permaweb/stampjs';

import { StampsType } from 'helpers/types';

const stamps = Stamps.init({});

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
