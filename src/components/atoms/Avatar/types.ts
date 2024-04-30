import { ProfileHeaderType, RegistryProfileType } from 'helpers/types';

export interface IProps {
	owner: ProfileHeaderType | RegistryProfileType | null;
	dimensions: {
		wrapper: number;
		icon: number;
	};
	callback: () => void | null;
}
