import { AssetDetailType } from 'helpers/types';

export interface IProps {
	asset: AssetDetailType;
	toggleUpdate: () => void;
	toggleViewType: () => void;
}
