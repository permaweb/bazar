import React from 'react';
import { Link } from 'react-router-dom';

import { getCollections } from 'api';

import * as GS from 'app/styles';
import { Loader } from 'components/atoms/Loader';
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

	const [collections, setCollections] = React.useState<CollectionType[] | null>(null);
	const [loading, setLoading] = React.useState<boolean>(false);
	const [errorResponse, setErrorResponse] = React.useState<string | null>(null);

	React.useEffect(() => {
		(async function () {
			setLoading(true);
			try {
				const collectionsFetch: CollectionType[] = await getCollections(props.owner);
				if (collections) {
					setCollections([...collections, ...collectionsFetch]);
				} else setCollections(collectionsFetch);
			} catch (e: any) {
				setErrorResponse(e.message || language.collectionsFetchFailed);
			}
			setLoading(false);
		})();
	}, []);

	function getData() {
		if (collections) {
			if (collections.length > 0) {
				return (
					<S.Wrapper className={'fade-in'}>
						<S.Header>
							<h4>{language.collections}</h4>
						</S.Header>
						<S.ListHeader>
							<span>{language.collection}</span>
							<S.DateCreated>
								<span>{language.createdOn}</span>
							</S.DateCreated>
						</S.ListHeader>
						<S.CollectionsWrapper>
							{collections.map((collection: CollectionType, index: number) => {
								const redirect = `${URLS.collection}${collection.id}`;

								return (
									<S.CollectionWrapper key={index} className={'border-wrapper-alt2 fade-in'}>
										<Link to={redirect}>
											<S.FlexElement>
												<S.Index>
													<span>{index + 1}</span>
												</S.Index>
												<S.Thumbnail className={'border-wrapper-primary'}>
													<img src={getTxEndpoint(collection.thumbnail || DEFAULTS.thumbnail)} alt={'Thumbnail'} />
												</S.Thumbnail>
												<S.Title>
													<p>{collection.title}</p>
												</S.Title>
											</S.FlexElement>
											<S.DateCreated>
												<S.FlexElement>
													<span>{formatDate(collection.dateCreated, 'epoch')}</span>
												</S.FlexElement>
											</S.DateCreated>
										</Link>
									</S.CollectionWrapper>
								);
							})}
						</S.CollectionsWrapper>
					</S.Wrapper>
				);
			} else {
				return (
					<GS.FullMessageWrapper className={'fade-in border-wrapper-alt2'}>
						<p>{language.noCollectionsFound}</p>
					</GS.FullMessageWrapper>
				);
			}
		} else {
			if (loading) return <Loader />;
			else if (errorResponse) return <p>{errorResponse}</p>;
			else {
				return (
					<GS.FullMessageWrapper className={'fade-in border-wrapper-alt2'}>
						<p>{language.noCollectionsFound}</p>
					</GS.FullMessageWrapper>
				);
			}
		}
	}

	return getData();
}
