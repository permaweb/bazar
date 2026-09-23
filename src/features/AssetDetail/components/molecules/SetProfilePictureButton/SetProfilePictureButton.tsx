import { UserRound } from 'lucide-react';

import { Button } from 'components/atoms/Button';
import { Icon } from 'components/atoms/Icon';

import { useProfilePictureUpdate } from '../../../hooks/useProfilePictureUpdate';

export default function SetProfilePictureButton(props: {
	assetId: string;
	disabled: boolean;
	image: string;
	owner: string;
}) {
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
					? 'Checking ownership…'
					: update.status === 'signing'
					? 'Approve profile…'
					: update.status === 'uploading'
					? 'Publishing profile…'
					: update.status === 'done'
					? 'Profile picture set'
					: 'Set as profile picture'}
			</Button>
			{update.error ? (
				<small className="profile-picture-error" role="alert">
					{update.error}
				</small>
			) : null}
		</>
	);
}
