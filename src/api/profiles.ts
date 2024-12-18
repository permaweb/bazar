import AsyncLock from 'async-lock';

import { readHandler } from 'api';

import { AO } from 'helpers/config';
import { store } from 'store';
import * as profilesActions from 'store/profiles/actions';

export type AOProfileType = {
	id: string;
	walletAddress: string;
	displayName: string | null;
	username: string | null;
	bio: string | null;
	avatar: string | null;
	banner: string | null;
	version: string | null;
};

export type ProfileHeaderType = AOProfileType;

export type RegistryProfileType = {
	id: string;
	avatar: string | null;
	username: string;
	bio?: string;
};

const TTL_MS = 10 * 60 * 1000;

export async function getProfileById(args: { profileId: string }): Promise<ProfileHeaderType | null> {
	const emptyProfile = {
		id: args.profileId,
		walletAddress: null,
		displayName: null,
		username: null,
		bio: null,
		avatar: null,
		banner: null,
		version: null,
	};

	try {
		const fetchedProfile = await readHandler({
			processId: args.profileId,
			action: 'Info',
			data: null,
		});

		if (fetchedProfile) {
			return {
				id: args.profileId,
				walletAddress: fetchedProfile.Owner || null,
				displayName: fetchedProfile.Profile.DisplayName || null,
				username: fetchedProfile.Profile.UserName || null,
				bio: fetchedProfile.Profile.Description || null,
				avatar: fetchedProfile.Profile.ProfileImage || null,
				banner: fetchedProfile.Profile.CoverImage || null,
				version: fetchedProfile.Profile.Version || null,
			};
		} else return emptyProfile;
	} catch (e: any) {
		throw new Error(e);
	}
}

export async function getProfileByWalletAddress(args: { address: string }): Promise<ProfileHeaderType | null> {
	const emptyProfile = {
		id: null,
		walletAddress: args.address,
		displayName: null,
		username: null,
		bio: null,
		avatar: null,
		banner: null,
		version: null,
	};

	try {
		const userProfiles = store.getState().profilesReducer.userProfiles;
		const cachedProfile = userProfiles ? store.getState().profilesReducer.userProfiles[args.address] : null;

		if (cachedProfile) {
			return cachedProfile;
		}

		const profileLookup = await readHandler({
			processId: AO.profileRegistry,
			action: 'Get-Profiles-By-Delegate',
			data: { Address: args.address },
		});

		let activeProfileId: string;
		if (profileLookup && profileLookup.length > 0 && profileLookup[0].ProfileId) {
			activeProfileId = profileLookup[0].ProfileId;
		}

		if (activeProfileId) {
			const fetchedProfile = await readHandler({
				processId: activeProfileId,
				action: 'Info',
				data: null,
			});

			if (fetchedProfile) {
				const userProfile = {
					id: activeProfileId,
					walletAddress: fetchedProfile.Owner || null,
					displayName: fetchedProfile.Profile.DisplayName || null,
					username: fetchedProfile.Profile.UserName || null,
					bio: fetchedProfile.Profile.Description || null,
					avatar: fetchedProfile.Profile.ProfileImage || null,
					banner: fetchedProfile.Profile.CoverImage || null,
					version: fetchedProfile.Profile.Version || null,
				};

				const registryProfiles = store.getState().profilesReducer.registryProfiles;
				const newProfile = { [args.address]: userProfile };

				store.dispatch(
					profilesActions.setProfiles({
						...store.getState().profilesReducer,
						userProfiles: { ...userProfiles, ...newProfile },
						registryProfiles,
					})
				);

				return userProfile;
			} else return emptyProfile;
		} else return emptyProfile;
	} catch (e: any) {
		throw new Error(e);
	}
}

const lock = new AsyncLock();

export async function getRegistryProfiles(args: { profileIds: string[] }): Promise<RegistryProfileType[]> {
	return lock.acquire('getRegistryProfiles', async () => {
		try {
			const state = store.getState().profilesReducer;
			let { registryProfiles = [], missingProfileIds = [], lastUpdate = 0 } = state;

			const isCacheValid = Date.now() - lastUpdate < TTL_MS;

			/*
            The cache is to old, update all the profiles again
          */
			if (!isCacheValid) {
				const metadataLookup = await readHandler({
					processId: AO.profileRegistry,
					action: 'Get-Metadata-By-ProfileIds',
					data: { ProfileIds: args.profileIds },
				});

				const fetchedIds = metadataLookup.map((profile: { ProfileId: string }) => profile.ProfileId);
				const newMissingProfileIds = args.profileIds.filter((id) => !fetchedIds.includes(id));

				store.dispatch(
					profilesActions.setProfiles({
						...state,
						registryProfiles: metadataLookup,
						missingProfileIds: [...new Set([...newMissingProfileIds])],
						lastUpdate: Date.now(),
					})
				);

				return args.profileIds.map((id) => {
					const profile = metadataLookup.find((profile: { ProfileId: string }) => profile.ProfileId === id);
					return {
						id: profile?.ProfileId || id,
						username: profile?.Username || null,
						avatar: profile?.ProfileImage || null,
						bio: profile?.Description ?? null,
					};
				});
			}

			const cachedProfiles = args.profileIds
				.map((id) => registryProfiles.find((profile: { ProfileId: string }) => profile.ProfileId === id))
				.filter(Boolean);

			const filteredIds = args.profileIds.filter(
				(id) =>
					!registryProfiles.some((profile: { ProfileId: string }) => profile.ProfileId === id) &&
					!missingProfileIds.includes(id)
			);

			missingProfileIds = missingProfileIds.filter((id: string) => args.profileIds.includes(id));

			if (cachedProfiles.length + missingProfileIds.length === args.profileIds.length) {
				return args.profileIds.map((id) => {
					const profile = cachedProfiles.find((profile: { ProfileId: string }) => profile.ProfileId === id);
					return {
						id: profile?.ProfileId || id,
						username: profile?.Username || null,
						avatar: profile?.ProfileImage || null,
						bio: profile?.Description ?? null,
					};
				});
			}

			const metadataLookup =
				filteredIds.length > 0
					? await readHandler({
							processId: AO.profileRegistry,
							action: 'Get-Metadata-By-ProfileIds',
							data: { ProfileIds: filteredIds },
					  })
					: [];

			const fetchedIds = metadataLookup.map((profile: { ProfileId: string }) => profile.ProfileId);
			const newMissingProfileIds = filteredIds.filter((id) => !fetchedIds.includes(id));

			const combinedProfiles = [...registryProfiles, ...metadataLookup].reduce<any[]>((uniqueProfiles, profile) => {
				if (!uniqueProfiles.some((existing) => existing.ProfileId === profile.ProfileId)) {
					uniqueProfiles.push(profile);
				}
				return uniqueProfiles;
			}, []);

			store.dispatch(
				profilesActions.setProfiles({
					...state,
					registryProfiles: combinedProfiles,
					missingProfileIds: [...new Set([...missingProfileIds, ...newMissingProfileIds])],
					lastUpdate: Date.now(),
				})
			);

			return args.profileIds.map((id) => {
				const profile = combinedProfiles.find((profile: { ProfileId: string }) => profile.ProfileId === id);
				return {
					id: profile?.ProfileId || id,
					username: profile?.Username || null,
					avatar: profile?.ProfileImage || null,
					bio: profile?.Description ?? null,
				};
			});
		} catch (e: any) {
			console.error('Error in getRegistryProfiles:', e);
			throw new Error(e.message);
		}
	});
}
