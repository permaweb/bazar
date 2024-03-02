import { ProfileType } from 'helpers/types';

export interface IProps {
	owner: ProfileType | null;
	dimensions: {
		wrapper: number;
		icon: number;
	};
	callback: () => void | null;
}
