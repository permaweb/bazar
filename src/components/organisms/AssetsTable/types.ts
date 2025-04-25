import { CollectionDetailType } from 'helpers/types';

export interface IProps {
	ids?: string[];
	loadingIds?: boolean;
	type: 'list' | 'grid';
	pageCount?: number;
	setProfileAction?: boolean;
	noListings?: boolean;
	currentListings?: CollectionDetailType['currentListings'];
}
