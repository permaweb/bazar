import { AssetDetailType, CollectionType } from 'helpers/types';

export interface IProps {
	collections: CollectionType[] | null;
	loading: boolean;
	onPlayTrack?: (asset: AssetDetailType) => void;
	currentTrack?: AssetDetailType | null;
	isPlaying?: boolean;
}
