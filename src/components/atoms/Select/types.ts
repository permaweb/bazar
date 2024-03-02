import { SelectOptionType } from 'helpers/types';

export interface IProps {
	label: string;
	activeOption: SelectOptionType;
	setActiveOption: (option: SelectOptionType) => void;
	options: SelectOptionType[];
	disabled: boolean;
}
