import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { connect } from '@permaweb/aoconnect';
import AOProfile, { ProfileType } from '@permaweb/aoprofile';

import { Loader } from 'components/atoms/Loader';
import { URLTabs } from 'components/molecules/URLTabs';
import { ASSETS, URLS } from 'helpers/config';
import { checkValidAddress } from 'helpers/utils';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { usePermawebProvider } from 'providers/PermawebProvider';

import { ProfileActivity } from './ProfileActivity';
import { ProfileAssets } from './ProfileAssets';
import { ProfileCollections } from './ProfileCollections';
import { ProfileHeader } from './ProfileHeader';

export default function Profile() {
	const permawebProvider = usePermawebProvider();

	const navigate = useNavigate();

	const { address, active } = useParams();

	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [profile, setProfile] = React.useState<ProfileType | null>(null);
	const [toggleUpdate, setToggleUpdate] = React.useState<boolean>(false);

	React.useEffect(() => {
		if (!address && !active) navigate(URLS.notFound);
		if (address && !active) navigate(URLS.profileAssets(address));
	}, [address, active, navigate]);

	React.useEffect(() => {
		if (!profile) document.body.style.overflow = 'hidden';
		else document.body.style.overflow = 'auto';
	}, []);

	React.useEffect(() => {
		(async function () {
			if (address && checkValidAddress(address)) {
				try {
					let fetchedProfile = null;
					let isLegacyProfile = false;

					fetchedProfile = await permawebProvider.libs.getProfileById(address);

					if (!fetchedProfile?.id || !fetchedProfile?.username) {
						await new Promise((r) => setTimeout(r, 1000));
						console.log('Fetching legacy profile...');
						isLegacyProfile = true;
						const aoProfile = AOProfile.init({ ao: connect({ MODE: 'legacy' }) });
						fetchedProfile = await aoProfile.getProfileById({ profileId: address });
					}

					setProfile({ ...fetchedProfile, isLegacyProfile });
				} catch (e: any) {
					console.error(e);
				}
			} else {
				navigate(URLS.notFound);
			}
		})();
	}, [address]);

	const TABS = React.useMemo(
		() => [
			{
				label: language.assets,
				icon: ASSETS.asset,
				disabled: false,
				url: URLS.profileAssets(address),
				view: () => <ProfileAssets address={address} profile={profile} />,
			},
			{
				label: language.collections,
				icon: ASSETS.collection,
				disabled: false,
				url: URLS.profileCollections(address),
				view: () => (
					<ProfileCollections
						address={address}
						collectionIds={!(profile as any).isLegacyProfile ? (profile as any)?.collections ?? null : null}
					/>
				),
			},
			{
				label: language.activity,
				icon: ASSETS.activity,
				disabled: false,
				url: URLS.profileActivity(address),
				view: () => <ProfileActivity address={address} />,
			},
		],
		[address, profile]
	);

	const urlTabs = React.useMemo(() => {
		return <URLTabs tabs={TABS} activeUrl={TABS[0].url} />;
	}, [TABS]);

	return profile ? (
		<>
			<ProfileHeader profile={profile} handleUpdate={() => setToggleUpdate(!toggleUpdate)} />
			{urlTabs}
		</>
	) : (
		<Loader />
	);
}
