import { AssetDetailType } from '@permaweb/libs';

export interface IProps {
	asset: AssetDetailType;
	updating: boolean;
	toggleUpdate: () => void;
	toggleViewType: () => void;
}
