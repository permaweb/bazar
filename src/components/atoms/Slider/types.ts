import { ValidationType } from 'helpers/types';

export interface IProps {
	value: number;
	maxValue: number;
	handleChange: (e: any) => void;
	invalid: ValidationType;
	label?: string;
	disabled: boolean;
	minValue?: number;
}
