export interface IProps {
	amount: string | number;
	currency: string;
	callback?: () => void;
	useReverseLayout?: boolean;
	hideSymbol?: boolean;
}
