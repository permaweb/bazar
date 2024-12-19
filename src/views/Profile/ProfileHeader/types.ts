import { ProfileType } from 'helpers/types';

export interface IProps {
	profile: ProfileType | null;
	handleUpdate: () => void;
}
