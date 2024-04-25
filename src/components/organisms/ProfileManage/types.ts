import { ProfileHeaderType } from 'helpers/types';

export interface IProps {
	profile: ProfileHeaderType | null;
	handleClose: (handleUpdate: boolean) => void;
	handleUpdate: () => void;
}
