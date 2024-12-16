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
		const cachedProfile = store.getState().profilesReducer.userProfile;

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

				store.dispatch(profilesActions.setProfiles({ userProfile, registryProfiles }));

				return userProfile;
			} else return emptyProfile;
		} else return emptyProfile;
	} catch (e: any) {
		throw new Error(e);
	}
}

let cacheLock: Promise<void> | null = null;
const TTL_MS = 10 * 60 * 1000;

async function withLock<T>(criticalSection: () => Promise<T>): Promise<T> {
	while (cacheLock) {
		await cacheLock;
	}

	let release: () => void;
	cacheLock = new Promise((resolve) => {
		release = resolve;
	});

	try {
		return await criticalSection();
	} finally {
		cacheLock = null;
		release!();
	}
}

/*
  We dont want the logic to overlap when there are
  many different requests to this function, thats
  why there is a lock implemented here.
*/
export async function getRegistryProfiles(args: { profileIds: string[] }): Promise<RegistryProfileType[]> {
	return withLock(async () => {
		try {
			const state = store.getState().profilesReducer;
			let { registryProfiles = [], missingProfileIds = [], cacheTimestamp = 0 } = state;

			const isCacheValid = Date.now() - cacheTimestamp < TTL_MS;

			/*
        The cache is to old, update all the profiles again
      */
			if (!isCacheValid) {
				console.log('Cache no longer valid');

				const metadataLookup = await readHandler({
					processId: AO.profileRegistry,
					action: 'Get-Metadata-By-ProfileIds',
					data: { ProfileIds: args.profileIds },
				});

				const fetchedIds = metadataLookup.map((profile: { ProfileId: string }) => profile.ProfileId);
				const newMissingProfileIds = args.profileIds.filter((id) => !fetchedIds.includes(id));

				store.dispatch(
					profilesActions.setProfiles({
						registryProfiles: metadataLookup,
						missingProfileIds: [...new Set([...newMissingProfileIds])],
						cacheTimestamp: Date.now(),
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
				.filter(Boolean) as RegistryProfileType[];

			const filteredIds = args.profileIds.filter(
				(id) =>
					!registryProfiles.some((profile: { ProfileId: string }) => profile.ProfileId === id) &&
					!missingProfileIds.includes(id)
			);

			missingProfileIds = missingProfileIds.filter((id: string) => args.profileIds.includes(id));

			if (cachedProfiles.length + missingProfileIds.length === args.profileIds.length) {
				console.log('All profiles are cached or missing:', cachedProfiles);
				return cachedProfiles;
			}

			console.log('Some or all profiles are not cached');

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
					registryProfiles: combinedProfiles,
					missingProfileIds: [...new Set([...missingProfileIds, ...newMissingProfileIds])],
					cacheTimestamp: Date.now(),
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
