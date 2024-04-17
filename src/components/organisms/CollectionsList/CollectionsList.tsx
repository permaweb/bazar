import React from 'react';
import { Link } from 'react-router-dom';

import { getCollections } from 'api';

import { Button } from 'components/atoms/Button';
import { Loader } from 'components/atoms/Loader';
import { CURSORS, DEFAULTS, URLS } from 'helpers/config';
import { getTxEndpoint } from 'helpers/endpoints';
import { CollectionGQLResponseType, CollectionType } from 'helpers/types';
import { formatDate } from 'helpers/utils';
import { useLanguageProvider } from 'providers/LanguageProvider';

import * as S from './styles';
import { IProps } from './types';

export default function CollectionsList(props: IProps) {
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [collections, setCollections] = React.useState<CollectionGQLResponseType | null>(null);
	const [nextCursor, setNextCursor] = React.useState<string | null>(null);
	const [toggleUpdate, setToggleUpdate] = React.useState<boolean>(false);
	const [loading, setLoading] = React.useState<boolean>(false);
	const [errorResponse, setErrorResponse] = React.useState<string | null>(null);

	React.useEffect(() => {
		(async function () {
			setLoading(true);
			try {
				const collectionsFetch: CollectionGQLResponseType = await getCollections({
					cursor: nextCursor,
					owner: props.owner,
				});
				if (collections) {
					setCollections({
						data: [...collections.data, ...collectionsFetch.data],
						nextCursor: collectionsFetch.nextCursor,
						previousCursor: collectionsFetch.previousCursor,
						count: collections.data.length + collectionsFetch.data.length,
					});
				} else setCollections(collectionsFetch);

				setNextCursor(collectionsFetch.nextCursor);
			} catch (e: any) {
				setErrorResponse(e.message || language.collectionsFetchFailed);
			}
			setLoading(false);
		})();
	}, [toggleUpdate]);

	function getData() {
		if (collections && collections.data) {
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
						{collections.data.map((collection: CollectionType, index: number) => {
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
												<p>{collection.data.title}</p>
											</S.Title>
										</S.FlexElement>
										<S.DateCreated>
											<S.FlexElement>
												<span>{formatDate(collection.data.dateCreated, 'iso')}</span>
											</S.FlexElement>
										</S.DateCreated>
									</Link>
								</S.CollectionWrapper>
							);
						})}
						{nextCursor && nextCursor !== CURSORS.end && (
							<S.UpdateWrapper>
								<Button
									type={'primary'}
									label={'Load more'}
									handlePress={() => setToggleUpdate(!toggleUpdate)}
									disabled={loading}
									loading={loading}
									height={60}
									width={350}
								/>
							</S.UpdateWrapper>
						)}
					</S.CollectionsWrapper>
				</S.Wrapper>
			);
		} else {
			if (loading) return <Loader />;
			else if (errorResponse) return <p>{errorResponse}</p>;
			else return null;
		}
	}

	return getData();
}
