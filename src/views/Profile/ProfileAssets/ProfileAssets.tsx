import React from 'react';

import { getAssetIdsByUser } from 'api';

import { Loader } from 'components/atoms/Loader';
import { AssetsTable } from 'components/organisms/AssetsTable';
import { PAGINATORS } from 'helpers/config';

import * as S from './styles';
import { IProps } from './types';

const ProfileAssets = React.memo((props: IProps) => {
	const [assetIds, setAssetIds] = React.useState<string[] | null>(null);

	React.useEffect(() => {
		(async function () {
			if (props.address && !assetIds) {
				setAssetIds(await getAssetIdsByUser({ profileId: props.address }));
			}
		})();
	}, [props.address]);

	return props.address && assetIds ? (
		<S.Wrapper>
			<AssetsTable ids={assetIds} type={'grid'} pageCount={PAGINATORS.profile.assets} />
		</S.Wrapper>
	) : (
		<Loader />
	);
});

export default ProfileAssets;
