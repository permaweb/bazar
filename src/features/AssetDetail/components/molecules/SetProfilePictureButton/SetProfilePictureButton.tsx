import { UserRound } from 'lucide-react';

import { Button } from 'components/atoms/Button';
import { Icon } from 'components/atoms/Icon';
import { useMessages } from 'providers/LanguageProvider';

import { useProfilePictureUpdate } from '../../../hooks/useProfilePictureUpdate';
import { ASSET_DETAIL_MESSAGES } from '../../../messages';

import * as S from './styles';

export default function SetProfilePictureButton(props: {
	assetId: string;
	disabled: boolean;
	image: string;
	owner: string;
}) {
	const messages = useMessages(ASSET_DETAIL_MESSAGES);
	const update = useProfilePictureUpdate({ assetId: props.assetId, owner: props.owner, image: props.image });
	return (
		<>
			<Button
				className="with-icon"
				disabled={props.disabled || update.status !== 'idle'}
				onClick={() => void update.apply()}
				size="custom"
				type="button"
			>
				<Icon icon={UserRound} size="sm" />
				{update.status === 'checking'
					? messages.profilePictureChecking
					: update.status === 'signing'
					? messages.profilePictureSigning
					: update.status === 'uploading'
					? messages.profilePictureUploading
					: update.status === 'done'
					? messages.profilePictureDone
					: messages.profilePictureIdle}
			</Button>
			{update.error ? (
				<S.ErrorMessage className="profile-picture-error" role="alert">
					{update.error}
				</S.ErrorMessage>
			) : null}
		</>
	);
}
