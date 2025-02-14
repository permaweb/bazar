import { AssetDetailType } from 'helpers/types';

export interface IProps {
	activityId?: string;
	asset?: AssetDetailType;
	assetIds?: string[];
	address?: string;
	groupCount?: number;
	startDate?: number;
	endDate?: number;
}
