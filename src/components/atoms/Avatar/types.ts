import { ProfileType, RegistryProfileType } from 'helpers/types';

export interface IProps {
	owner: ProfileType | RegistryProfileType | null;
	dimensions: {
		wrapper: number;
		icon: number;
	};
	callback: () => void | null;
}
