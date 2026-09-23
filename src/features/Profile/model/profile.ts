import {
	type AccountProfile as AccountProfileRecord,
	PROFILE_AVATAR_CONTENT_TYPES,
	PROFILE_AVATAR_MAX_BYTES,
	profileAvatarUrl,
	profileDisplayName,
	type ProfileUpdate,
} from 'api/profile';

import { type AppErrorReason, appErrorReasonMessage, toAppError } from 'helpers/app-error';
import { isArweaveId } from 'helpers/arweave-id';
import { type AsyncState } from 'helpers/async-state';
import type { ProfileSummary } from 'types/profile';

export type { AccountProfileRecord };

/** A read profile: `null` when the address has not published one. */
export type AccountProfileState = AsyncState<AccountProfileRecord | null>;

export type ProfileEditUpdate = {
	displayName: string;
	displayNameChanged: boolean;
	avatarFile: File | null;
	removeAvatar: boolean;
};

/** The two uploads a profile save can sign: an optional picture, then the profile document. */
export type ProfileSaveStage = 'picture' | 'profile';
export type ProfileUploadPhase = 'signing' | 'uploading';

export function profileImageError(file: File): string {
	if (!PROFILE_AVATAR_CONTENT_TYPES.includes(file.type)) return appErrorReasonMessage('invalid-profile-avatar-type');
	if (!file.size || file.size > PROFILE_AVATAR_MAX_BYTES) return appErrorReasonMessage('invalid-profile-avatar-size');
	return '';
}

/** Failures a profile update explains specifically; every other failure keeps the general profile copy. */
const PROFILE_UPDATE_FAILURES = new Set<AppErrorReason>([
	'invalid-profile-avatar',
	'invalid-profile-avatar-type',
	'invalid-profile-avatar-size',
	'profile-wallet-account-changed',
]);

export function profileUpdateError(cause: unknown): string {
	const { reason } = toAppError(cause, 'profile-update-failed');
	return appErrorReasonMessage(PROFILE_UPDATE_FAILURES.has(reason) ? reason : 'profile-update-failed');
}

/**
 * The patch a profile save publishes: the name only when it changed, and the picture as the freshly uploaded
 * avatar, an explicit removal, or untouched.
 */
export function profileUpdateFields(update: ProfileEditUpdate, uploadedAvatar?: string): ProfileUpdate {
	return {
		...(update.displayNameChanged ? { displayName: update.displayName } : {}),
		...(uploadedAvatar !== undefined ? { avatar: uploadedAvatar } : update.removeAvatar ? { avatar: '' } : {}),
	};
}

export function profileSaveStatus(stage: ProfileSaveStage, phase: ProfileUploadPhase): string {
	if (stage === 'picture') return phase === 'signing' ? 'Approve picture…' : 'Uploading picture…';
	return phase === 'signing' ? 'Approve profile…' : 'Publishing profile…';
}

export const PROFILE_SAVE_PREPARING_STATUS = 'Preparing profile…';

/** Display-ready identity for a profile page, falling back to the bare address while nothing is published. */
export function accountProfileSummary(
	address: string,
	profile: AccountProfileRecord | null | undefined
): ProfileSummary {
	const displayName = profileDisplayName(profile);
	const avatar = profileAvatarUrl(profile);
	return {
		address,
		...(displayName ? { displayName } : {}),
		...(profile?.bio ? { bio: profile.bio } : {}),
		...(avatar ? { avatar } : {}),
	};
}

/** The loading and failure notice a profile page shows for an address and its read state. */
export function accountProfileNotice(
	address: string,
	state: AccountProfileState
): { isLoading: boolean; error: string } {
	if (!isArweaveId(address)) return { isLoading: false, error: 'This is not a valid Arweave profile address.' };
	if (state.status === 'error' || state.status === 'stale') {
		return { isLoading: false, error: 'This profile could not be read from Arweave.' };
	}
	return { isLoading: state.status === 'loading' || state.status === 'idle', error: '' };
}
