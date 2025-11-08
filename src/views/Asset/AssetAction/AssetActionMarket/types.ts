import { AssetDetailType } from 'helpers/types';

export interface IProps {
	asset: AssetDetailType;
	getCurrentListings: any;
	getCurrentBids: any;
	toggleUpdate: () => void;
	updating: boolean;
	hasLegacyOrderbook: boolean;
}
