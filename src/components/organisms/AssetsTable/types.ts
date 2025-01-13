export interface IProps {
	ids?: string[];
	loadingIds?: boolean;
	type: 'list' | 'grid';
	pageCount?: number;
	setProfileAction?: boolean;
	noListings?: boolean;
}
