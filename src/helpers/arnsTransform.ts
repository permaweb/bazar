import { AoArNSNameDataWithName } from '@ar.io/sdk';

import { ANTInfo, ARNSRecord } from '../types/ant';

export function transformArnsRecord(sdkRecord: AoArNSNameDataWithName, antInfo?: ANTInfo): ARNSRecord {
	return {
		name: sdkRecord.name,
		processId: sdkRecord.processId,
		startTimestamp: sdkRecord.startTimestamp,
		// For permabuy records, endTimestamp is 0
		endTimestamp: sdkRecord.type === 'lease' ? (sdkRecord as any).endTimestamp || 0 : 0,
		type: sdkRecord.type || 'permabuy',
		antInfo,
	};
}
