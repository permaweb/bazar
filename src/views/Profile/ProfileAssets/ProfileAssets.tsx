import React from 'react';

import { AssetsTable } from 'components/organisms/AssetsTable';
import { PAGINATORS } from 'helpers/config';

import * as S from './styles';
import { IProps } from './types';

const ProfileAssets = React.memo((props: IProps) => {
	const [assetIds, setAssetIds] = React.useState<string[] | null>(null);

	React.useEffect(() => {
		(async function () {
			if (props.profile && !assetIds) {
				if (props.profile.assets) setAssetIds(props.profile.assets);
			}
		})();
	}, [props.profile]);

	return props.profile ? (
		<S.Wrapper>
			<AssetsTable
				ids={assetIds}
				loadingIds={!assetIds}
				type={'grid'}
				pageCount={PAGINATORS.profile.assets}
				setProfileAction={true}
				noListings
			/>
		</S.Wrapper>
	) : null;
});

export default ProfileAssets;
