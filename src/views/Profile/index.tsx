import React from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { connect } from '@permaweb/aoconnect';
import AOProfile, { ProfileType } from '@permaweb/aoprofile';

import { Loader } from 'components/atoms/Loader';
import { URLTabs } from 'components/molecules/URLTabs';
import { ASSETS, URLS } from 'helpers/config';
import { checkValidAddress } from 'helpers/utils';
import { useLanguageProvider } from 'providers/LanguageProvider';

import { ProfileActivity } from './ProfileActivity';
import { ProfileAssets } from './ProfileAssets';
import { ProfileCollections } from './ProfileCollections';
import { ProfileHeader } from './ProfileHeader';

export default function Profile() {
	const { getProfileById } = AOProfile.init({ ao: connect({ MODE: 'legacy' }) });

	const location = useLocation();
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
					const fetchedProfile = await getProfileById({ profileId: address });
					setProfile(fetchedProfile);
				} catch (e: any) {
					console.error(e);
				}
			} else {
				navigate(URLS.notFound);
			}
		})();
	}, [address, location]);

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
				view: () => <ProfileCollections address={address} />,
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
