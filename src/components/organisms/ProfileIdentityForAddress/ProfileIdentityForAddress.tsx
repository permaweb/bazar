import { useAccountProfileSummary } from 'hooks/useAccountProfileSummary';

import { ProfileIdentity, ProfileIdentityProps } from '../../molecules/ProfileIdentity';

export default function ProfileIdentityForAddress(props: Omit<ProfileIdentityProps, 'profile'> & { address: string }) {
	const profile = useAccountProfileSummary(props.address);
	return (
		<ProfileIdentity
			className={props.className}
			profile={profile}
			showAvatar={props.showAvatar ?? false}
			size={props.size ?? 'small'}
		/>
	);
}
