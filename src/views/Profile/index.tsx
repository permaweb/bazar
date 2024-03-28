import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { getFullProfile } from 'api';

import { Loader } from 'components/atoms/Loader';
import { URLTabs } from 'components/molecules/URLTabs';
import { URLS } from 'helpers/config';
import { FullProfileType } from 'helpers/types';
import { checkValidAddress } from 'helpers/utils';
import { useLanguageProvider } from 'providers/LanguageProvider';

import { ProfileHeader } from './ProfileHeader';

export default function Profile() {
	const navigate = useNavigate();
	const { address, active } = useParams();

	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [profile, setProfile] = React.useState<FullProfileType | null>(null);

	React.useEffect(() => {
		if (!address && !active) navigate(URLS.notFound);
		if (address && !active) navigate(URLS.profileAssets(address));
	}, [address, active]);

	React.useEffect(() => {
		(async function () {
			if (address && checkValidAddress(address)) {
				try {
					const fetchedProfile = await getFullProfile({ address: address });
					setProfile(fetchedProfile);
				} catch (e: any) {
					console.error(e);
				}
			} else {
				navigate(URLS.notFound);
			}
		})();
	}, [address]);

	const TABS = [
		{
			label: language.assets,
			icon: null,
			disabled: false,
			url: URLS.profileAssets(address),
			view: () => <p>Profile assets</p>,
		},
		{
			label: language.collections,
			icon: null,
			disabled: false,
			url: URLS.profileCollections(address),
			view: () => <p>Profile collections</p>,
		},
		{
			label: language.listings,
			icon: null,
			disabled: false,
			url: URLS.profileListings(address),
			view: () => <p>Profile listings</p>,
		},
		{
			label: language.activity,
			icon: null,
			disabled: false,
			url: URLS.profileActivity(address),
			view: () => <p>Profile activity</p>,
		},
	];

	const urlTabs = React.useMemo(() => {
		return <URLTabs tabs={TABS} activeUrl={TABS[0]!.url} />;
	}, [address]);

	return profile ? (
		<>
			<ProfileHeader profile={profile} />
			{urlTabs}
		</>
	) : (
		<Loader />
	);
}
