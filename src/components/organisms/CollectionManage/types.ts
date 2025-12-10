import { CollectionDetailType } from 'helpers/types';

export interface IProps {
	collection: CollectionDetailType;
	handleClose: (() => void) | null;
	handleUpdate: () => void;
}
