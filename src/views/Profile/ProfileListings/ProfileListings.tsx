import * as GS from 'app/styles';

import * as S from './styles';
import { IProps } from './types';

export default function ProfileListings(props: IProps) {
	return props.address ? (
		<S.Wrapper>
			<GS.FullMessageWrapper className={'fade-in border-wrapper-alt2'}>
				<p>Coming soon!</p>
			</GS.FullMessageWrapper>
		</S.Wrapper>
	) : null;
}
