export interface IProps {
	value: number;
	maxValue: number;
	handleChange: (e: any) => void;
	label?: string;
	disabled: boolean;
	minValue?: number;
}
