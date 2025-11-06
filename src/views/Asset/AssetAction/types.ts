import { AssetDetailType } from 'helpers/types';

export interface IProps {
	asset: AssetDetailType;
	updating: boolean;
	toggleUpdate: () => void;
	toggleViewType: () => void;
	hasLegacyOrderbook: boolean;
}
