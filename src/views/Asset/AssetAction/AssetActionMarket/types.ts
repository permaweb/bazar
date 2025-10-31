import { AssetDetailType } from 'helpers/types';

export interface IProps {
	asset: AssetDetailType;
	getCurrentListings: any;
	toggleUpdate: () => void;
	updating: boolean;
}
