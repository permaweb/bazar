import { ProfileHeaderType } from 'helpers/types';

export interface IProps {
	handleClose: (handleUpdate: boolean) => void;
	profile: ProfileHeaderType | null;
}
