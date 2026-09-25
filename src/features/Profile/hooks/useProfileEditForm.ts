import React from 'react';

import { useAppErrorMessages } from 'hooks/useAppErrorMessage';
import { useMessages } from 'providers/LanguageProvider';
import type { ProfileSummary } from 'types/profile';

import { PROFILE_MESSAGES } from '../messages';
import type { ProfileEditUpdate } from '../model/profile';
import { profileUpdateError } from '../model/profile';
import {
	createProfileEditFormReducer,
	profileEditChanges,
	type ProfileEditFormState,
	profileEditFormState,
	profileEditPreview,
} from '../model/profile-edit-form';

import { useObjectUrl } from './useObjectUrl';

export type ProfileEditSaveHandler = (update: ProfileEditUpdate, onStatus: (status: string) => void) => Promise<void>;

export type ProfileEditForm = {
	form: ProfileEditFormState;
	avatarPreview: string;
	busy: boolean;
	error: string;
	status: string;
	displayNameChanged: boolean;
	pictureChanged: boolean;
	setDisplayName(displayName: string): void;
	selectAvatar(file: File | null): void;
	removeAvatar(): void;
	setDragging(dragging: boolean): void;
	submit(): Promise<void>;
};

/** The profile editor's form: resets whenever it opens, validates pictures, and runs the save with live status. */
export function useProfileEditForm(
	open: boolean,
	profile: Pick<ProfileSummary, 'avatar' | 'displayName'>,
	onSave: ProfileEditSaveHandler
): ProfileEditForm {
	const messages = useMessages(PROFILE_MESSAGES);
	const errorMessages = useAppErrorMessages();
	const reducer = React.useMemo(() => createProfileEditFormReducer(errorMessages), [errorMessages]);
	const [form, dispatch] = React.useReducer(reducer, {}, profileEditFormState);
	const fileUrl = useObjectUrl(form.avatarFile);
	const changes = profileEditChanges(form, profile);

	React.useEffect(() => {
		if (!open) return;
		dispatch({ type: 'opened', profile: { displayName: profile.displayName } });
	}, [open, profile.avatar, profile.displayName]);

	const reportStatus = React.useCallback((label: string) => dispatch({ type: 'save-progressed', label }), []);

	return {
		form,
		avatarPreview: profileEditPreview(form, fileUrl, profile.avatar),
		busy: form.save.status === 'saving',
		error: form.save.status === 'editing' ? form.save.error : '',
		status: form.save.status === 'saving' ? form.save.label : '',
		...changes,
		setDisplayName: (displayName) => dispatch({ type: 'name-changed', displayName }),
		selectAvatar: (file) => {
			if (file) dispatch({ type: 'avatar-selected', file });
		},
		removeAvatar: () => dispatch({ type: 'avatar-removed' }),
		setDragging: (dragging) => dispatch({ type: 'drag-changed', dragging }),
		submit: async () => {
			dispatch({
				type: 'save-started',
				preparingLabel: messages.profileSavePreparing,
				preparingPictureLabel: messages.profileSavePreparingPicture,
			});
			try {
				await onSave(
					{
						displayName: form.displayName,
						displayNameChanged: changes.displayNameChanged,
						avatarFile: form.avatarFile,
						removeAvatar: form.removeAvatar,
					},
					reportStatus
				);
			} catch (cause) {
				dispatch({ type: 'save-failed', error: profileUpdateError(cause, errorMessages) });
			}
		},
	};
}
