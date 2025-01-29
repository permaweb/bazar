import { ProfileType, RegistryProfileType } from '@permaweb/aoprofile';

export interface IProps {
	owner: ProfileType | RegistryProfileType | null;
	dimensions: {
		wrapper: number;
		icon: number;
	};
	callback: () => void | null;
}
