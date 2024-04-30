import { CollectionsList } from 'components/organisms/CollectionsList';

import * as S from './styles';
import { IProps } from './types';

export default function ProfileCollections(props: IProps) {
	return props.address ? (
		<S.Wrapper>
			<CollectionsList owner={props.address} />
		</S.Wrapper>
	) : null;
}
