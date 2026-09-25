import { type AssetState, ownerOfAsset } from 'api/marketplace';

import type { AppError } from 'helpers/app-error';

/** Stages of publishing an owned asset's artwork as the account's profile picture. */
export type ProfilePictureStatus = 'idle' | 'checking' | 'signing' | 'uploading' | 'done';

/**
 * The update in progress, scoped by `key` so a completion for a previous asset, wallet, or image can never label a
 * different one as done.
 */
export type ProfilePictureUpdate = { key: string; status: ProfilePictureStatus; error: AppError | null };

export type ProfilePictureEvent =
	| { type: 'started'; key: string }
	| { type: 'phase'; key: string; phase: 'signing' | 'uploading' }
	| { type: 'succeeded'; key: string }
	| { type: 'failed'; key: string; error: AppError };

export const INITIAL_PROFILE_PICTURE_UPDATE: ProfilePictureUpdate = { key: '', status: 'idle', error: null };

export function profilePictureUpdateKey(assetId: string, owner: string, image: string): string {
	return `${assetId}\0${owner}\0${image}`;
}

function inProgress(status: ProfilePictureStatus): boolean {
	return status === 'checking' || status === 'signing' || status === 'uploading';
}

export function profilePictureUpdateReducer(
	update: ProfilePictureUpdate,
	event: ProfilePictureEvent
): ProfilePictureUpdate {
	if (event.type === 'started') return { key: event.key, status: 'checking', error: null };
	if (event.key !== update.key || !inProgress(update.status)) return update;
	switch (event.type) {
		case 'phase':
			return { ...update, status: event.phase };
		case 'succeeded':
			return { ...update, status: 'done', error: null };
		case 'failed':
			return { ...update, status: 'idle', error: event.error };
	}
}

/** What the button shows for `key`: an update for another asset, wallet, or image never applies to it. */
export function profilePictureUpdateView(
	update: ProfilePictureUpdate,
	key: string
): { status: ProfilePictureStatus; error: AppError | null } {
	return update.key === key ? { status: update.status, error: update.error } : { status: 'idle', error: null };
}

/** A profile picture may only be published from a unique asset this wallet currently owns. */
export function profilePictureOwnershipConfirmed(state: AssetState, owner: string): boolean {
	return state.totalSupply === '1' && state.denomination <= 0 && ownerOfAsset(state) === owner;
}
