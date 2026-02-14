import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';

import AOProfile, { ProfileType } from '@permaweb/aoprofile';

import { Loader } from 'components/atoms/Loader';
import { URLTabs } from 'components/molecules/URLTabs';
import { connect } from 'helpers/aoconnect';
import { ASSETS, URLS } from 'helpers/config';
import { checkValidAddress } from 'helpers/utils';
import { useLanguageProvider } from 'providers/LanguageProvider';
import { usePermawebProvider } from 'providers/PermawebProvider';

import { ProfileActivity } from './ProfileActivity';
import { ProfileAssets } from './ProfileAssets';
import { ProfileCollections } from './ProfileCollections';
import { ProfileHeader } from './ProfileHeader';
const debug = (..._args: any[]) => {};

const ErrorWrapper = styled.div`
	padding: 40px 20px;
	text-align: center;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	min-height: 400px;
`;

const ErrorMessage = styled.p`
	color: ${(props) => props.theme.colors.font.primary};
	font-size: ${(props) => props.theme.typography.size.base};
	font-weight: ${(props) => props.theme.typography.weight.medium};
	margin: 0 0 10px 0;
`;

const ErrorDetail = styled.p`
	color: ${(props) => props.theme.colors.font.alt1};
	font-size: ${(props) => props.theme.typography.size.small};
	margin: 0;
`;

export default function Profile() {
	const permawebProvider = usePermawebProvider();

	const navigate = useNavigate();

	const { address, active } = useParams();

	const languageProvider = useLanguageProvider();
	const language = languageProvider.object[languageProvider.current];

	const [profile, setProfile] = React.useState<ProfileType | null>(null);
	const [toggleUpdate, setToggleUpdate] = React.useState<boolean>(false);
	const [profileError, setProfileError] = React.useState<boolean>(false);

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
				setProfileError(false);
				try {
					let fetchedProfile = null;
					let isLegacyProfile = false;

					fetchedProfile = await permawebProvider.libs.getProfileById(address);

					// If mainnet profile not found, try legacy as fallback
					if (!fetchedProfile?.id || !fetchedProfile?.username) {
						debug('Mainnet profile not found, trying legacy...');
						isLegacyProfile = true;
						const aoProfile = AOProfile.init({ ao: connect({ MODE: 'legacy' }) });
						fetchedProfile = await aoProfile.getProfileById({ profileId: address });
					}

					if (fetchedProfile && fetchedProfile.id) {
						setProfile({ ...fetchedProfile, isLegacyProfile });
					} else {
						setProfileError(true);
					}
				} catch (e: any) {
					console.error('Error fetching profile:', e);
					setProfileError(true);
				}
			} else {
				navigate(URLS.notFound);
			}
		})();
	}, [address, navigate, permawebProvider.libs]);

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

	if (profileError) {
		return (
			<ErrorWrapper>
				<ErrorMessage>
					Unable to load profile. This profile may not be hydrated on HyperBEAM yet, or there may be network issues.
				</ErrorMessage>
				<ErrorDetail>Profile ID: {address}</ErrorDetail>
			</ErrorWrapper>
		);
	}

	return profile ? (
		<>
			<ProfileHeader profile={profile} handleUpdate={() => setToggleUpdate(!toggleUpdate)} />
			{urlTabs}
		</>
	) : (
		<Loader />
	);
}
