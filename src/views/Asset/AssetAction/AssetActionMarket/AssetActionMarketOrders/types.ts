import { AssetDetailType, AssetMarketActionOrderType } from 'helpers/types';

export interface IProps {
	asset: AssetDetailType;
	type: AssetMarketActionOrderType;
	toggleUpdate: () => void;
}
