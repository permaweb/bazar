import { ProfileType } from 'helpers/types';

export interface IProps {
	profile: ProfileType | null;
	handleClose: (handleUpdate: boolean) => void;
	handleUpdate: () => void;
}
