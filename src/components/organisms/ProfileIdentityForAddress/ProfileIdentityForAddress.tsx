import { formatMessage } from 'helpers/i18n';
import { useAccountProfileSummary } from 'hooks/useAccountProfileSummary';
import { useMessages } from 'providers/LanguageProvider';

import { profileAccessibleName, ProfileIdentity, ProfileIdentityProps } from '../../molecules/ProfileIdentity';

import { PROFILE_IDENTITY_FOR_ADDRESS_MESSAGES } from './messages';

export default function ProfileIdentityForAddress(
	props: Omit<ProfileIdentityProps, 'label' | 'profile'> & { address: string }
) {
	const messages = useMessages(PROFILE_IDENTITY_FOR_ADDRESS_MESSAGES);
	const profile = useAccountProfileSummary(props.address);
	return (
		<ProfileIdentity
			className={props.className}
			label={formatMessage(messages.profileIdentityLabel, { name: profileAccessibleName(profile) })}
			profile={profile}
			showAvatar={props.showAvatar ?? false}
			size={props.size ?? 'small'}
		/>
	);
}
