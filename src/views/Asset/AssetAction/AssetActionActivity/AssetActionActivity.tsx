import { Loader } from 'components/atoms/Loader';
import { ActivityTable } from 'components/organisms/ActivityTable';

import { IProps } from './types';

export default function AssetActionActivity(props: IProps) {
	return props.asset ? <ActivityTable assetIds={[props.asset.data.id]} /> : <Loader sm relative />;
}
