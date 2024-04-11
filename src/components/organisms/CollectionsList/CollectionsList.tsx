import { Link } from 'react-router-dom';

import { DEFAULTS, URLS } from 'helpers/config';
import { getTxEndpoint } from 'helpers/endpoints';
import { CollectionType } from 'helpers/types';
import { formatDate } from 'helpers/utils';
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
			<S.ListHeader>
				<span>{language.collection}</span>
				<span>{language.createdOn}</span>
			</S.ListHeader>
			<S.CollectionsWrapper>
				{props.collections.map((collection: CollectionType, index: number) => {
					const redirect = `${URLS.collection}${collection.data.id}`;

					return (
						<S.CollectionWrapper key={index} className={'border-wrapper-primary fade-in'}>
							<Link to={redirect}>
								<S.FlexElement>
									<S.Index>
										<span>{index + 1}</span>
									</S.Index>
									<S.Thumbnail className={'border-wrapper-alt2'}>
										<img src={getTxEndpoint(collection.data.thumbnail || DEFAULTS.thumbnail)} alt={'Thumbnail'} />
									</S.Thumbnail>
									<S.Title>
										<span>{collection.data.title}</span>
									</S.Title>
								</S.FlexElement>
								<S.FlexElement>
									<span>{formatDate(collection.data.dateCreated, 'iso')}</span>
								</S.FlexElement>
							</Link>
						</S.CollectionWrapper>
					);
				})}
			</S.CollectionsWrapper>
		</S.Wrapper>
	) : null;
}
