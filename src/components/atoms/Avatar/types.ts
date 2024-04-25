import { ProfileHeaderType } from 'helpers/types';

export interface IProps {
	owner: ProfileHeaderType | null;
	dimensions: {
		wrapper: number;
		icon: number;
	};
	callback: () => void | null;
}
