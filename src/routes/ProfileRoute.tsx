import React from 'react';
import { useParams } from 'react-router-dom';
import { MapPin } from 'lucide-react';

import { profileAvatarUrl, profileDisplayName, readAccountProfile } from 'api/profile';

import { ProfileAvatar, type ProfileSummary, shortProfileAddress } from 'components/ProfileIdentity';

import './ProfileRoute.css';

import MyAssetsRoute from './MyAssetsRoute';

export type ProfileRouteProps = {
	action?: React.ReactNode;
	children?: React.ReactNode;
	error?: string | null;
	isLoading?: boolean;
	onRetry?: () => void;
	profile: ProfileSummary;
};

export function ProfilePage({ action, children, error, isLoading = false, onRetry, profile }: ProfileRouteProps) {
	const name = profile.displayName?.trim() || shortProfileAddress(profile.address);

	return (
		<section className="profile-page">
			<section className="profile-page__hero" aria-labelledby="profile-page-title">
				<div className="profile-page__identity">
					<ProfileAvatar className="profile-page__avatar" profile={profile} size="large" />
					<div className="profile-page__heading">
						<p className="profile-page__eyebrow">Arweave profile</p>
						<h1 id="profile-page-title">{name}</h1>
						<p className="profile-page__address" title={profile.address}>
							{profile.address}
						</p>
					</div>
					{action ? <div className="profile-page__action">{action}</div> : null}
				</div>
				{profile.bio ? <p className="profile-page__bio">{profile.bio}</p> : null}
			</section>

			{isLoading ? (
				<div aria-live="polite" className="profile-page__notice">
					<MapPin aria-hidden="true" size={16} /> Resolving this profile from Arweave…
				</div>
			) : null}
			{error ? (
				<div className="profile-page__notice profile-page__notice--error" role="alert">
					<span>{error}</span>
					{onRetry ? (
						<button onClick={onRetry} type="button">
							Retry
						</button>
					) : null}
				</div>
			) : null}
			{children ? <section className="profile-page__content">{children}</section> : null}
		</section>
	);
}

const ADDRESS = /^[A-Za-z0-9_-]{43}$/;

export default function ProfileRoute() {
	const { address = '' } = useParams();
	const [retry, setRetry] = React.useState(0);
	const [profile, setProfile] = React.useState<Awaited<ReturnType<typeof readAccountProfile>>>();
	const [error, setError] = React.useState('');

	React.useEffect(() => {
		setError('');
		setProfile(undefined);
		if (!ADDRESS.test(address)) {
			setError('This is not a valid Arweave profile address.');
			return;
		}
		const controller = new AbortController();
		void readAccountProfile(address, { signal: controller.signal }).then(
			(value) => {
				if (!controller.signal.aborted) setProfile(value);
			},
			() => {
				if (!controller.signal.aborted) setError('This profile could not be read from Arweave.');
			}
		);
		return () => controller.abort();
	}, [address, retry]);

	const summary: ProfileSummary = {
		address,
		...(profileDisplayName(profile) ? { displayName: profileDisplayName(profile) } : {}),
		...(profile?.bio ? { bio: profile.bio } : {}),
		...(profileAvatarUrl(profile) ? { avatar: profileAvatarUrl(profile) } : {}),
	};
	return (
		<ProfilePage
			error={error}
			isLoading={ADDRESS.test(address) && profile === undefined && !error}
			onRetry={() => setRetry((value) => value + 1)}
			profile={summary}
		>
			{ADDRESS.test(address) ? <MyAssetsRoute address={address} embedded /> : null}
		</ProfilePage>
	);
}
