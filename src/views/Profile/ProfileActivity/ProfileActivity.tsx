import { ActivityTable } from 'components/organisms/ActivityTable';

import * as S from './styles';
import { IProps } from './types';

export default function ProfileActivity(props: IProps) {
	return props.address ? (
		<S.Wrapper>
			<ActivityTable address={props.address} />
		</S.Wrapper>
	) : null;
}
