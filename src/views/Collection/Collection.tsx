import { useParams } from 'react-router-dom';

import { CollectionMarket } from 'features/Collection';

export default function Collection() {
	const { collectionId = '' } = useParams();
	return <CollectionMarket key={collectionId} />;
}
