import { AssetDetailType, AssetRenderType } from 'helpers/types';

export interface IProps {
	asset: AssetDetailType;
	preview?: boolean;
	frameMinHeight?: number;
	autoLoad?: boolean;
	loadRenderer?: boolean;
	assetRender?: AssetRenderType;
}
