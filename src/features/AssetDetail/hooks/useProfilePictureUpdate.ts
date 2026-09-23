import React from 'react';

import { readAssetStateWithDeadline } from 'api/marketplace';
import { ProfileClient } from 'api/profile';

import { appError, toAppError } from 'helpers/app-error';
import { useAppErrorMessage } from 'hooks/useAppErrorMessage';

import {
	INITIAL_PROFILE_PICTURE_UPDATE,
	profilePictureOwnershipConfirmed,
	type ProfilePictureStatus,
	profilePictureUpdateKey,
	profilePictureUpdateReducer,
	profilePictureUpdateView,
} from '../model/profile-picture';

export type ProfilePictureUpdateState = {
	status: ProfilePictureStatus;
	error: string | null;
	/** Confirm ownership from live state, then sign and publish the profile update. */
	apply(): Promise<void>;
};

/**
 * Publish an owned asset's artwork as the connected account's profile picture. Ownership is re-checked against live
 * state immediately before the wallet is asked to sign, and the result applies only to the asset, wallet, and image
 * it was started for.
 */
export function useProfilePictureUpdate(input: {
	assetId: string;
	owner: string;
	image: string;
}): ProfilePictureUpdateState {
	const [update, dispatch] = React.useReducer(profilePictureUpdateReducer, INITIAL_PROFILE_PICTURE_UPDATE);
	const errorMessage = useAppErrorMessage();
	const key = profilePictureUpdateKey(input.assetId, input.owner, input.image);

	const apply = React.useCallback(async () => {
		dispatch({ type: 'started', key });
		try {
			const current = await readAssetStateWithDeadline(input.assetId, { maxAge: 0 });
			if (!profilePictureOwnershipConfirmed(current.state, input.owner)) {
				throw appError('profile-avatar-not-owned');
			}
			await new ProfileClient().setAvatar(input.owner, input.image, {
				onPhase: (phase) => dispatch({ type: 'phase', key, phase }),
			});
			dispatch({ type: 'succeeded', key });
		} catch (cause) {
			dispatch({ type: 'failed', key, error: toAppError(cause, 'profile-update-failed') });
		}
	}, [input.assetId, input.image, input.owner, key]);

	const view = profilePictureUpdateView(update, key);
	return { status: view.status, error: view.error ? errorMessage(view.error) : null, apply };
}
