import { AssetDetailType } from 'helpers/types';

export interface IProps {
	asset?: AssetDetailType;
	assetIds?: string[];
	address?: string;
	groupCount?: number;
}
