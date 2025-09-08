import { OwnerLine } from 'components/molecules/OwnerLine';
import { DEFAULTS } from 'helpers/config';
import { getTxEndpoint } from 'helpers/endpoints';
import { useLanguageProvider } from 'providers/LanguageProvider';

import * as S from './styles';
import { IProps } from './types';

export default function CollectionCard(props: IProps) {
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	return props.collection ? (
		<S.Wrapper className={'fade-in'}>
			<S.InfoWrapper>
				<S.InfoHeader>
					<h4>{props.collection.title}</h4>
				</S.InfoHeader>
				<S.InfoCreator>
					<p>{language.createdBy}</p>
					<OwnerLine
						owner={{
							address: props.collection.creator,
							profile: props.collection.creatorProfile,
						}}
						callback={null}
					/>
				</S.InfoCreator>
				{props.collection.description && (
					<S.InfoDescription>
						<p>{props.collection.description}</p>
					</S.InfoDescription>
				)}
			</S.InfoWrapper>
			<S.BannerWrapper className={'border-wrapper-alt2'}>
				<img
					src={getTxEndpoint(props.collection.banner || props.collection.thumbnail || DEFAULTS.banner)}
					alt={props.collection.title || 'Collection Banner'}
					onError={(e) => {
						// Try fallback to default banner
						if (!e.currentTarget.src.includes(DEFAULTS.banner)) {
							e.currentTarget.src = getTxEndpoint(DEFAULTS.banner);
						}
					}}
				/>
			</S.BannerWrapper>
		</S.Wrapper>
	) : null;
}
