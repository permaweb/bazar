import { AssetDetailType, SelectOptionType } from 'helpers/types';

export interface IProps {
	assets: AssetDetailType[];
	type: 'list' | 'grid';
	nextAction: () => void | null;
	previousAction: () => void | null;
	filterListings: boolean;
	setFilterListings: () => void | null;
	currentSortType: SelectOptionType;
	setCurrentSortType: (option: SelectOptionType) => void;
	currentPage?: string;
	pageCount?: number;
	loading?: boolean;
}
