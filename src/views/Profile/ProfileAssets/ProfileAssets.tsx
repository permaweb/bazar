import React from 'react';

import { getAssetIdGroups, getAssetIdsByUser, getAssetsByIds } from 'api';

import { AssetsTable } from 'components/organisms/AssetsTable';
import { ASSET_SORT_OPTIONS, PAGINATORS, STYLING } from 'helpers/config';
import { AssetDetailType, AssetSortType, IdGroupType, SelectOptionType } from 'helpers/types';
import * as windowUtils from 'helpers/window';
import { useLanguageProvider } from 'providers/LanguageProvider';

import * as S from './styles';
import { IProps } from './types';

export default function ProfileAssets(props: IProps) {
	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [_desktop, setDesktop] = React.useState(windowUtils.checkWindowCutoff(parseInt(STYLING.cutoffs.initial)));

	const [assetIds, setAssetIds] = React.useState<string[] | null>(null);
	const [assetIdGroups, setAssetIdGroups] = React.useState<IdGroupType | null>(null);
	const [assetFilterListings, setAssetFilterListings] = React.useState<boolean>(false);
	const [assetSortType, setAssetSortType] = React.useState<SelectOptionType | null>(ASSET_SORT_OPTIONS[0]);
	const [assetCursor, setAssetCursor] = React.useState<string>('0');

	const [assets, setAssets] = React.useState<AssetDetailType[] | null>(null);
	const [assetsLoading, setAssetsLoading] = React.useState<boolean>(false);
	const [assetErrorResponse, setAssetErrorResponse] = React.useState<string | null>(null);

	React.useEffect(() => {
		(async function () {
			if (props.address) {
				setAssetsLoading(true);
				setAssetIds(await getAssetIdsByUser({ profileId: props.address }));
			}
		})();
	}, [props.address]);

	React.useEffect(() => {
		(async function () {
			if (assetIds) {
				if (assetIds.length) {
					setAssetIdGroups(
						getAssetIdGroups({
							ids: assetIds,
							groupCount: PAGINATORS.profile.assets,
							filterListings: assetFilterListings,
							sortType: assetSortType.id as AssetSortType,
						})
					);
				} else {
					setAssets([]);
					setAssetsLoading(false);
				}
			}
		})();
	}, [assetIds, assetFilterListings, assetSortType]);

	React.useEffect(() => {
		(async function () {
			if (assetIdGroups) {
				try {
					setAssets(
						await getAssetsByIds({ ids: assetIdGroups[assetCursor], sortType: assetSortType.id as AssetSortType })
					);
				} catch (e: any) {
					setAssetErrorResponse(e.message || language.assetsFetchFailed);
				}
				setAssetsLoading(false);
			}
			// else {
			// 	setAssetsLoading(false);
			// }
		})();
	}, [assetIdGroups, assetCursor, assetSortType]);

	function handleWindowResize() {
		if (windowUtils.checkWindowCutoff(parseInt(STYLING.cutoffs.initial))) {
			setDesktop(true);
		} else {
			setDesktop(false);
		}
	}

	windowUtils.checkWindowResize(handleWindowResize);

	function getPaginationAction(callback: () => void) {
		setAssets(null);
		callback();
	}

	function getNextAction() {
		if (assetIdGroups && Number(assetCursor) < Object.keys(assetIdGroups).length - 1) {
			return () => getPaginationAction(() => setAssetCursor((Number(assetCursor) + 1).toString()));
		}
		return null;
	}

	function getPreviousAction() {
		if (assetIdGroups && Number(assetCursor) > 0) {
			return () => getPaginationAction(() => setAssetCursor((Number(assetCursor) - 1).toString()));
		}
		return null;
	}

	return props.address ? (
		<S.Wrapper>
			<AssetsTable
				assets={assets}
				type={'grid'}
				nextAction={getNextAction()}
				previousAction={getPreviousAction()}
				filterListings={assetFilterListings}
				setFilterListings={() => setAssetFilterListings(!assetFilterListings)}
				currentSortType={assetSortType}
				setCurrentSortType={(option: SelectOptionType) => setAssetSortType(option)}
				currentPage={assetCursor}
				pageCount={PAGINATORS.profile.assets}
				loading={assetsLoading}
			/>
			{assetErrorResponse && <p>{assetErrorResponse}</p>}
		</S.Wrapper>
	) : null;
}
