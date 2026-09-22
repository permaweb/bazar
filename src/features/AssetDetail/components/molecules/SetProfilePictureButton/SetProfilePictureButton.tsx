import React from 'react';
import { UserRound } from 'lucide-react';

import { ownerOfAsset, readAssetStateWithDeadline } from 'api/marketplace';
import { ProfileClient } from 'api/profile';

import { Button } from 'components/atoms/Button';
import { Icon } from 'components/atoms/Icon';
import { appError, appErrorMessage, toAppError } from 'helpers/app-error';

export default function SetProfilePictureButton(props: {
	assetId: string;
	disabled: boolean;
	image: string;
	owner: string;
}) {
	const [status, setStatus] = React.useState<'idle' | 'checking' | 'signing' | 'uploading' | 'done'>('idle');
	const [error, setError] = React.useState('');
	const apply = async () => {
		setError('');
		setStatus('checking');
		try {
			const current = await readAssetStateWithDeadline(props.assetId, { maxAge: 0 });
			if (
				current.state.totalSupply !== '1' ||
				current.state.denomination > 0 ||
				ownerOfAsset(current.state) !== props.owner
			) {
				throw appError('profile-avatar-not-owned');
			}
			await new ProfileClient().setAvatar(props.owner, props.image, {
				onPhase: (phase) => setStatus(phase),
			});
			setStatus('done');
		} catch (cause) {
			setStatus('idle');
			setError(appErrorMessage(toAppError(cause, 'profile-update-failed')));
		}
	};
	return (
		<>
			<Button
				className="with-icon"
				disabled={props.disabled || status !== 'idle'}
				onClick={() => void apply()}
				size="custom"
				type="button"
			>
				<Icon icon={UserRound} size="sm" />
				{status === 'checking'
					? 'Checking ownership…'
					: status === 'signing'
					? 'Approve profile…'
					: status === 'uploading'
					? 'Publishing profile…'
					: status === 'done'
					? 'Profile picture set'
					: 'Set as profile picture'}
			</Button>
			{error ? (
				<small className="profile-picture-error" role="alert">
					{error}
				</small>
			) : null}
		</>
	);
}
