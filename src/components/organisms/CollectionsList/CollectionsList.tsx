import React from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';

import { getCollections } from 'api';

import * as GS from 'app/styles';
import { Loader } from 'components/atoms/Loader';
import { DEFAULTS, URLS } from 'helpers/config';
import { getTxEndpoint } from 'helpers/endpoints';
import { CollectionType } from 'helpers/types';
import { formatDate } from 'helpers/utils';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { usePermawebProvider } from 'providers/PermawebProvider';
import { RootState } from 'store';

import * as S from './styles';
import { IProps } from './types';

function CollectionListItem(props: { index: number; collection: CollectionType }) {
	const wrapperRef = React.useRef<any>(null);

	const [wrapperVisible, setWrapperVisible] = React.useState<boolean>(false);
	const [frameLoaded, setFrameLoaded] = React.useState<boolean>(false);

	const checkVisibility = () => {
		const element = wrapperRef.current;
		if (!element) return;

		const scroll = window.scrollY || window.pageYOffset;
		const boundsTop = element.getBoundingClientRect().top + scroll;

		const viewport = {
			top: scroll,
			bottom: scroll + window.innerHeight,
		};

		const bounds = {
			top: boundsTop,
			bottom: boundsTop + element.clientHeight,
		};

		const visible = bounds.bottom >= viewport.top && bounds.top <= viewport.bottom;
		setWrapperVisible(visible);
		if (visible) setFrameLoaded(true);
	};

	React.useEffect(() => {
		checkVisibility();
		window.addEventListener('scroll', checkVisibility);
		window.addEventListener('resize', checkVisibility);

		return () => {
			window.removeEventListener('scroll', checkVisibility);
			window.removeEventListener('resize', checkVisibility);
		};
	}, [props.collection]);

	return (
		<S.CollectionWrapper ref={wrapperRef} className={'border-wrapper-alt2 fade-in'}>
			<Link to={URLS.collectionAssets(props.collection.id)}>
				<S.FlexElement>
					<S.Index>
						<span>{props.index + 1}</span>
					</S.Index>
					<S.Thumbnail className={'border-wrapper-primary'}>
						{wrapperVisible || frameLoaded ? (
							<img src={getTxEndpoint(props.collection.thumbnail || DEFAULTS.thumbnail)} alt={'Thumbnail'} />
						) : (
							<S.Placeholder>
								<span>...</span>
							</S.Placeholder>
						)}
					</S.Thumbnail>
					<S.Title>
						<p>{props.collection.title}</p>
					</S.Title>
				</S.FlexElement>
				<S.DateCreated>
					<S.FlexElement>
						<span>{formatDate(props.collection.dateCreated, 'epoch')}</span>
					</S.FlexElement>
				</S.DateCreated>
			</Link>
		</S.CollectionWrapper>
	);
}

export default function CollectionsList(props: IProps) {
	const collectionsReducer = useSelector((state: RootState) => state.collectionsReducer);

	const permawebProvider = usePermawebProvider();
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [collections, setCollections] = React.useState<CollectionType[] | null>(null);
	const [loading, setLoading] = React.useState<boolean>(true);
	const [errorResponse, setErrorResponse] = React.useState<string | null>(null);

	React.useEffect(() => {
		(async function () {
			if (!collections) {
				setLoading(true);
				try {
					if (props.collectionIds) {
						const fetchedCollections = [];
						for (const collectionId of props.collectionIds) {
							await new Promise((r) => setTimeout(r, 200));
							const collection = await permawebProvider.libs.getCollection(collectionId);
							fetchedCollections.push(collection);
						}
						setCollections(fetchedCollections);
					} else {
						if (props.owner) {
							if (collectionsReducer?.creators?.[props.owner]?.collections?.length) {
								setCollections(collectionsReducer.creators[props.owner].collections);
								setLoading(false);
							}
						} else {
							if (collectionsReducer?.all?.collections?.length) {
								setCollections(collectionsReducer.all.collections);
								setLoading(false);
							}
						}
					}

					if (!props.collectionIds) {
						const collectionsFetch: CollectionType[] = await getCollections(props.owner);
						if (props.owner) {
							setCollections(collectionsFetch.filter((collection) => collection.creator === props.owner));
						} else setCollections(collectionsFetch);
					}
				} catch (e: any) {
					setErrorResponse(e.message || language.collectionsFetchFailed);
				}
				setLoading(false);
			}
		})();
	}, [props.owner, collectionsReducer?.all, collectionsReducer?.creators]);

	function getData() {
		if (collections) {
			if (collections.length > 0) {
				return (
					<S.Wrapper className={'fade-in'}>
						<S.Header>
							<h4>{`${language.collections}${collections && collections.length ? ` (${collections.length})` : ''}`}</h4>
						</S.Header>
						<S.ListHeader>
							<span>{language.collection}</span>
							<S.DateCreated>
								<span>{language.createdOn}</span>
							</S.DateCreated>
						</S.ListHeader>
						<S.CollectionsWrapper>
							{collections.map((collection: CollectionType, index: number) => {
								return <CollectionListItem key={index} index={index} collection={collection} />;
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
			if (loading) return <Loader sm relative />;
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
