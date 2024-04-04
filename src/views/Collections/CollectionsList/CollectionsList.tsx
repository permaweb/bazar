import { Link } from 'react-router-dom';

import { DEFAULTS, URLS } from 'helpers/config';
import { getTxEndpoint } from 'helpers/endpoints';
import { CollectionType } from 'helpers/types';
import { useLanguageProvider } from 'providers/LanguageProvider';

import * as S from './styles';
import { IProps } from './types';

export default function CollectionsList(props: IProps) {
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	return props.collections ? (
		<S.Wrapper className={'fade-in'}>
			<S.Header>
				<h4>{language.collections}</h4>
			</S.Header>
			<S.CollectionsWrapper>
				{props.collections.map((collection: CollectionType, index: number) => {
					const redirect = `${URLS.collection}${collection.data.id}`;

					return (
						<S.CollectionWrapper key={index} className={'border-wrapper-primary fade-in'}>
							<Link to={redirect}>
								<S.Thumbnail className={'border-wrapper-alt2'}>
									<img src={getTxEndpoint(collection.data.thumbnail || DEFAULTS.thumbnail)} alt={'Thumbnail'} />
								</S.Thumbnail>
							</Link>
							<Link to={redirect}>
								<S.Title>
									<span>{collection.data.title}</span>
								</S.Title>
							</Link>
						</S.CollectionWrapper>
					);
				})}
			</S.CollectionsWrapper>
		</S.Wrapper>
	) : null;
}
