import { AssetDetailType } from '@permaweb/libs';

import { AssetRenderType } from 'helpers/types';

export interface IProps {
	asset: AssetDetailType;
	preview?: boolean;
	frameMinHeight?: number;
	autoLoad?: boolean;
	loadRenderer?: boolean;
	assetRender?: AssetRenderType;
	scrolling?: boolean;
}
