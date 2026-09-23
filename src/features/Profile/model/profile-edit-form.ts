import type { ProfileSummary } from 'types/profile';

import { PROFILE_SAVE_PREPARING_STATUS, profileImageError } from './profile';

/** Editing accepts changes and may show the last failure; saving locks the form behind the wallet status label. */
export type ProfileEditSave = { status: 'editing'; error: string } | { status: 'saving'; label: string };

export type ProfileEditFormState = {
	displayName: string;
	avatarFile: File | null;
	removeAvatar: boolean;
	dragging: boolean;
	save: ProfileEditSave;
};

export type ProfileEditFormEvent =
	| { type: 'opened'; profile: Pick<ProfileSummary, 'displayName'> }
	| { type: 'name-changed'; displayName: string }
	| { type: 'avatar-selected'; file: File }
	| { type: 'avatar-removed' }
	| { type: 'drag-changed'; dragging: boolean }
	| { type: 'save-started' }
	| { type: 'save-progressed'; label: string }
	| { type: 'save-failed'; error: string };

export function profileEditFormState(profile: Pick<ProfileSummary, 'displayName'>): ProfileEditFormState {
	return {
		displayName: profile.displayName ?? '',
		avatarFile: null,
		removeAvatar: false,
		dragging: false,
		save: { status: 'editing', error: '' },
	};
}

/**
 * The profile editor's form and save flow. Every control is disabled while a save is signing or publishing, so
 * edits arriving during a save are ignored rather than racing the wallet request; status updates arrive only then.
 */
export function profileEditFormReducer(state: ProfileEditFormState, event: ProfileEditFormEvent): ProfileEditFormState {
	const saving = state.save.status === 'saving';
	switch (event.type) {
		case 'opened':
			return profileEditFormState(event.profile);
		case 'name-changed':
			return saving ? state : { ...state, displayName: event.displayName };
		case 'avatar-selected': {
			if (saving) return state;
			const error = profileImageError(event.file);
			return {
				...state,
				avatarFile: error ? null : event.file,
				removeAvatar: false,
				save: { status: 'editing', error },
			};
		}
		case 'avatar-removed':
			return saving ? state : { ...state, avatarFile: null, removeAvatar: true };
		case 'drag-changed':
			return state.dragging === event.dragging ? state : { ...state, dragging: event.dragging };
		case 'save-started':
			return {
				...state,
				save: {
					status: 'saving',
					label: state.avatarFile ? 'Preparing picture…' : PROFILE_SAVE_PREPARING_STATUS,
				},
			};
		case 'save-progressed':
			return saving ? { ...state, save: { status: 'saving', label: event.label } } : state;
		case 'save-failed':
			return { ...state, save: { status: 'editing', error: event.error } };
	}
}

export function profileEditChanges(
	state: ProfileEditFormState,
	profile: Pick<ProfileSummary, 'displayName'>
): { displayNameChanged: boolean; pictureChanged: boolean } {
	return {
		displayNameChanged: state.displayName.trim() !== (profile.displayName ?? '').trim(),
		pictureChanged: Boolean(state.avatarFile) || state.removeAvatar,
	};
}

/** The picture the editor shows: the new file, nothing after a removal, or the current avatar. */
export function profileEditPreview(state: ProfileEditFormState, fileUrl: string, currentAvatar?: string): string {
	if (state.avatarFile) return fileUrl;
	return state.removeAvatar ? '' : currentAvatar ?? '';
}
