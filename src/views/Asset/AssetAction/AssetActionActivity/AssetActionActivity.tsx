import { Loader } from 'components/atoms/Loader';
import { ActivityTable } from 'components/organisms/ActivityTable';

import { IProps } from './types';

export default function AssetActionActivity(props: IProps) {
	console.log(props.asset);
	return props.asset ? (
		<ActivityTable
			activityId={props.asset?.orderbook?.activityId}
			asset={props.asset}
			assetIds={[props.asset.data.id]}
		/>
	) : (
		<Loader sm relative />
	);
}
