import { OwnerType } from 'helpers/types';

export interface IProps {
	owner: OwnerType;
	callback: () => void;
}
