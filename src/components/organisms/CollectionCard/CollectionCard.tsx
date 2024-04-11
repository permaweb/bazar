import { OwnerLine } from 'components/molecules/OwnerLine';
import { DEFAULTS } from 'helpers/config';
import { getTxEndpoint } from 'helpers/endpoints';

import * as S from './styles';
import { IProps } from './types';

export default function CollectionCard(props: IProps) {
	return props.collection ? (
		<S.Wrapper className={'fade-in'}>
			<S.InfoWrapper>
				<S.InfoHeader>
					<h4>{props.collection.data.title}</h4>
				</S.InfoHeader>
				<S.InfoCreator>
					<p>{`Created by`}</p>
					<OwnerLine
						owner={{
							address: props.collection.data.creator,
							profile: props.collection.creatorProfile,
						}}
						callback={null}
					/>
				</S.InfoCreator>
				{props.collection.data.description && (
					<S.InfoDescription>
						<p>{props.collection.data.description}</p>
					</S.InfoDescription>
				)}
			</S.InfoWrapper>
			<S.BannerWrapper className={'border-wrapper-alt2'}>
				<img src={getTxEndpoint(props.collection.data.banner || DEFAULTS.thumbnail)} alt={'Banner'} />
			</S.BannerWrapper>
		</S.Wrapper>
	) : null;
}
