import { CollectionType } from 'helpers/types';

export interface IProps {
	collections: CollectionType[] | null;
	loading: boolean;
}
