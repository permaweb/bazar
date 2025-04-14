import React from 'react';

import { connect } from '@permaweb/aoconnect';
import AOProfile from '@permaweb/aoprofile';

import { AssetsTable } from 'components/organisms/AssetsTable';
import { PAGINATORS } from 'helpers/config';

import * as S from './styles';
import { IProps } from './types';

const ProfileAssets = React.memo((props: IProps) => {
	const [assetIds, setAssetIds] = React.useState<string[] | null>(null);
	const [loading, setLoading] = React.useState<boolean>(true);

	// Try to get profile assets for the address directly from AO Profile
	React.useEffect(() => {
		(async function () {
			// First check if we already have assets from the profile prop
			if (props.profile && props.profile.assets) {
				setAssetIds(props.profile.assets);
				setLoading(false);
				return;
			}

			// If we have an address but no profile, try to fetch directly
			if (props.address && !assetIds && loading) {
				try {
					// Only attempt to fetch if we don't already have a profile
					if (!props.profile) {
						const { getProfileById } = AOProfile.init({ ao: connect() });
						const profileData = await getProfileById({ profileId: props.address });

						if (profileData && profileData.assets) {
							setAssetIds(profileData.assets);
						}
					}
				} catch (e) {
					// If fetching fails, we'll just render without assets
					console.error('Error fetching profile assets:', e);
				}
				setLoading(false);
			}
		})();
	}, [props.profile, props.address, assetIds, loading]);

	// Always return the component, even if we don't have assets yet
	return (
		<S.Wrapper>
			{props.address && (
				<AssetsTable
					ids={assetIds}
					loadingIds={loading}
					type={'grid'}
					pageCount={PAGINATORS.profile.assets}
					setProfileAction={true}
				/>
			)}
		</S.Wrapper>
	);
});

export default ProfileAssets;
