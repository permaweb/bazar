import React from 'react';

import { ProfileClient, readAccountProfile } from 'api/profile';

import { toAppError } from 'helpers/app-error';
import { isArweaveId } from 'helpers/arweave-id';
import { asyncData, IDLE, LOADING } from 'helpers/async-state';
import { useMessages } from 'providers/LanguageProvider';
import type { ProfileSummary } from 'types/profile';

import { PROFILE_MESSAGES } from '../messages';
import {
	type AccountProfileState,
	accountProfileSummary,
	type ProfileEditUpdate,
	profileSaveStatus,
	profileUpdateFields,
} from '../model/profile';

export type AccountProfileController = {
	profile: AccountProfileState;
	summary: ProfileSummary;
	retry(): void;
	/** Upload an optional picture, then publish the profile; resolves once the new profile is shown. */
	save(update: ProfileEditUpdate, onStatus: (status: string) => void): Promise<void>;
};

/** Reads an address's published profile (latest address wins) and publishes the owner's edits. */
export function useAccountProfile(address: string): AccountProfileController {
	const messages = useMessages(PROFILE_MESSAGES);
	const [attempt, setAttempt] = React.useState(0);
	const [profile, setProfile] = React.useState<AccountProfileState>(() => (isArweaveId(address) ? LOADING : IDLE));
	const activeAddress = React.useRef(address);

	React.useEffect(() => {
		activeAddress.current = address;
		if (!isArweaveId(address)) {
			setProfile(IDLE);
			return;
		}
		setProfile(LOADING);
		const controller = new AbortController();
		void readAccountProfile(address, { signal: controller.signal }).then(
			(value) => {
				if (!controller.signal.aborted) setProfile({ status: 'success', data: value });
			},
			(cause) => {
				if (!controller.signal.aborted)
					setProfile({ status: 'error', error: toAppError(cause, 'unavailable') });
			}
		);
		return () => controller.abort();
	}, [address, attempt]);

	return {
		profile,
		summary: accountProfileSummary(address, asyncData(profile)),
		retry: () => setAttempt((value) => value + 1),
		save: async (update, onStatus) => {
			const client = new ProfileClient();
			let avatar: string | undefined;
			if (update.avatarFile) {
				const data = new Uint8Array(await update.avatarFile.arrayBuffer());
				avatar = await client.uploadAvatar(address, data, update.avatarFile.type, {
					onPhase: (phase) => onStatus(profileSaveStatus('picture', phase, messages)),
				});
			}
			onStatus(messages.profileSavePreparing);
			const updated = await client.update(address, profileUpdateFields(update, avatar), {
				onPhase: (phase) => onStatus(profileSaveStatus('profile', phase, messages)),
			});
			// A save that finishes after the page moved to another address must not replace that address's profile.
			if (activeAddress.current === address) setProfile({ status: 'success', data: updated });
		},
	};
}
