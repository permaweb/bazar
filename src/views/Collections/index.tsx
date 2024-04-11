import React from 'react';

import { getCollections } from 'api';

import { Loader } from 'components/atoms/Loader';
import { CollectionsList } from 'components/organisms/CollectionsList';
import { CollectionGQLResponseType, CollectionType } from 'helpers/types';
import { useLanguageProvider } from 'providers/LanguageProvider';

// TODO: pagination
export default function Collections() {
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [collectionsFetch, setCollectionsFetch] = React.useState<CollectionGQLResponseType | null>(null);
	const [cursor, setCursor] = React.useState<string | null>(null);
	const [loading, setLoading] = React.useState<boolean>(false);
	const [errorResponse, setErrorResponse] = React.useState<string | null>(null);

	React.useEffect(() => {
		(async function () {
			setLoading(true);
			try {
				const collectionsFetch: CollectionGQLResponseType = await getCollections({ cursor: cursor });
				setCollectionsFetch(collectionsFetch);
			} catch (e: any) {
				setErrorResponse(e.message || language.collectionsFetchFailed);
			}
			setLoading(false);
		})();
	}, [cursor]);

	function getData() {
		if (collectionsFetch) {
			return <CollectionsList collections={collectionsFetch.data} />;
		} else {
			if (loading) return <Loader />;
			else if (errorResponse) return <p>{errorResponse}</p>;
			else return null;
		}
	}

	return getData();
}
