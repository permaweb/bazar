import { Loader } from 'components/atoms/Loader';
import { ActivityTable } from 'components/organisms/ActivityTable';

import { IProps } from './types';

export default function AssetActionActivity(props: IProps) {
	return props.asset ? <ActivityTable activityId={props.asset?.orderbook?.activityId} /> : <Loader sm relative />;
}
