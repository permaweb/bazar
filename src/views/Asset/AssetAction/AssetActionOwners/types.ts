import { AssetDetailType, OwnerType } from 'helpers/types';

export interface IProps {
	asset: AssetDetailType;
	owners: OwnerType[] | null;
}
