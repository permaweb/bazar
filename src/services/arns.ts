import { ARIO } from '@ar.io/sdk';

import { ARNSToken } from '../types/arns';

export const arnsService = {
	async getArnsTokens(address: string): Promise<ARNSToken[]> {
		try {
			const ario = ARIO.mainnet();
			const records = await ario.getArNSRecords({
				limit: 100,
				sortBy: 'startTimestamp',
				sortOrder: 'desc',
			});
			return records.items;
		} catch (error) {
			console.error('Error fetching ARNS tokens:', error);
			return [];
		}
	},

	async resolveArnsName(name: string): Promise<string> {
		try {
			const ario = ARIO.mainnet();
			const record = await ario.resolveArNSName({ name });
			return record;
		} catch (error) {
			console.error('Error resolving ARNS name:', error);
			return '';
		}
	},
};
