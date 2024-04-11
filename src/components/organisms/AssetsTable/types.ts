import { AssetDetailType } from 'helpers/types';

export interface IProps {
	assets: AssetDetailType[];
	type: 'list' | 'grid';
	nextAction: () => void | null;
	previousAction: () => void | null;
	currentPage?: string;
	pageCount?: number;
	loading?: boolean;
}
