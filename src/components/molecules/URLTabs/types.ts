import { URLViewType } from 'helpers/types';

export interface ITProps {
	label: string;
	icon: string | null;
	disabled: boolean;
	active: boolean;
	handlePress: (url: string) => void;
	url: string;
}

export interface ICProps {
	tabs: URLViewType[];
}

export interface IUProps {
	tabs: URLViewType[];
	activeUrl: string;
	useFixed?: boolean;
}
