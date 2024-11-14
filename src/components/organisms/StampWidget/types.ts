export interface IProps {
	assetId: string;
	title: string;
	stamps?: { total: number; vouched: number } | null;
	hasStampedMessage?: string;
	getCount?: boolean;
	sm?: boolean;
	asButton?: boolean;
}
