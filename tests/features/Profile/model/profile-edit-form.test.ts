import { describe, expect, it } from 'vitest';

import {
	profileEditChanges,
	profileEditFormReducer,
	type ProfileEditFormState,
	profileEditFormState,
	profileEditPreview,
} from 'features/Profile/model/profile-edit-form';

const image = new File([new Uint8Array(4)], 'avatar.png', { type: 'image/png' });
const unsupported = new File([new Uint8Array(4)], 'avatar.svg', { type: 'image/svg+xml' });

function saving(state: ProfileEditFormState): ProfileEditFormState {
	return profileEditFormReducer(state, { type: 'save-started' });
}

describe('profile edit form', () => {
	it('resets every field when the editor opens', () => {
		const edited = profileEditFormReducer(
			profileEditFormReducer(profileEditFormState({}), { type: 'avatar-selected', file: image }),
			{ type: 'drag-changed', dragging: true }
		);
		expect(profileEditFormReducer(edited, { type: 'opened', profile: { displayName: 'Alice' } })).toEqual({
			displayName: 'Alice',
			avatarFile: null,
			removeAvatar: false,
			dragging: false,
			save: { status: 'editing', error: '' },
		});
	});

	it('keeps a valid picture and rejects an invalid one with its reason', () => {
		const removed = profileEditFormReducer(profileEditFormState({}), { type: 'avatar-removed' });
		const selected = profileEditFormReducer(removed, { type: 'avatar-selected', file: image });
		expect(selected).toMatchObject({ avatarFile: image, removeAvatar: false, save: { error: '' } });

		const rejected = profileEditFormReducer(selected, { type: 'avatar-selected', file: unsupported });
		expect(rejected).toMatchObject({
			avatarFile: null,
			removeAvatar: false,
			save: { status: 'editing', error: 'Choose a PNG, JPEG, WebP, or GIF image.' },
		});
	});

	it('labels the first save stage by whether a picture must upload', () => {
		expect(saving(profileEditFormState({})).save).toEqual({ status: 'saving', label: 'Preparing profile…' });
		const withPicture = profileEditFormReducer(profileEditFormState({}), { type: 'avatar-selected', file: image });
		expect(saving(withPicture).save).toEqual({ status: 'saving', label: 'Preparing picture…' });
	});

	it('clears the last failure when a save starts and restores it when the save fails', () => {
		const failed = profileEditFormReducer(saving(profileEditFormState({})), {
			type: 'save-failed',
			error: 'Your profile could not be updated. Please try again.',
		});
		expect(failed.save).toEqual({
			status: 'editing',
			error: 'Your profile could not be updated. Please try again.',
		});
		expect(saving(failed).save).toEqual({ status: 'saving', label: 'Preparing profile…' });
	});

	it('ignores edits and stray status updates outside their stage', () => {
		const busy = saving(profileEditFormState({ displayName: 'Alice' }));
		expect(profileEditFormReducer(busy, { type: 'name-changed', displayName: 'Bob' })).toBe(busy);
		expect(profileEditFormReducer(busy, { type: 'avatar-selected', file: image })).toBe(busy);
		expect(profileEditFormReducer(busy, { type: 'avatar-removed' })).toBe(busy);
		expect(profileEditFormReducer(busy, { type: 'save-progressed', label: 'Approve profile…' }).save).toEqual({
			status: 'saving',
			label: 'Approve profile…',
		});

		const idle = profileEditFormState({});
		expect(profileEditFormReducer(idle, { type: 'save-progressed', label: 'Approve profile…' })).toBe(idle);
		expect(profileEditFormReducer(idle, { type: 'drag-changed', dragging: false })).toBe(idle);
	});

	it('detects semantic changes and previews the picture that will be saved', () => {
		const opened = profileEditFormState({ displayName: ' Alice ' });
		expect(profileEditChanges(opened, { displayName: 'Alice' })).toEqual({
			displayNameChanged: false,
			pictureChanged: false,
		});
		const renamed = profileEditFormReducer(opened, { type: 'name-changed', displayName: 'Bob' });
		expect(profileEditChanges(renamed, { displayName: 'Alice' }).displayNameChanged).toBe(true);

		expect(profileEditPreview(opened, '', 'https://example.com/current.png')).toBe(
			'https://example.com/current.png'
		);
		const removed = profileEditFormReducer(opened, { type: 'avatar-removed' });
		expect(profileEditChanges(removed, {}).pictureChanged).toBe(true);
		expect(profileEditPreview(removed, '', 'https://example.com/current.png')).toBe('');
		const selected = profileEditFormReducer(removed, { type: 'avatar-selected', file: image });
		expect(profileEditPreview(selected, 'blob:new', 'https://example.com/current.png')).toBe('blob:new');
	});
});
