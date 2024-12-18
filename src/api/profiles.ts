import AsyncLock from 'async-lock';

import { readHandler } from 'api';

import { AO } from 'helpers/config';
import { ProfileHeaderType, RegistryProfileType } from 'helpers/types';
import { store } from 'store';
import * as profilesActions from 'store/profiles/actions';

const TTL_MS = 10 * 60 * 1000;

const lock = new AsyncLock();

let fetchQueue: Set<string> = new Set();

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

export async function getRegistryProfiles(args: { profileIds: string[] }): Promise<RegistryProfileType[]> {
	try {
		const metadataLookup = await readHandler({
			processId: AO.profileRegistry,
			action: 'Get-Metadata-By-ProfileIds',
			data: { ProfileIds: args.profileIds },
		});

		if (metadataLookup && metadataLookup.length) {
			return args.profileIds.map((profileId: string) => {
				const profile = metadataLookup.find((profile: { ProfileId: string }) => profile.ProfileId === profileId);
				return {
					id: profile ? profile.ProfileId : profileId,
					username: profile ? profile.Username : null,
					avatar: profile ? profile.ProfileImage : null,
					bio: profile ? profile.Description ?? null : null,
				};
			});
		}

		return [];
	} catch (e: any) {
		throw new Error(e);
	}
}

export function getExistingRegistryProfiles(ids: string[]): RegistryProfileType[] {
	const profilesReducer = store.getState().profilesReducer;
	if (!profilesReducer?.registryProfiles || !profilesReducer?.registryProfiles.length) return [];

	const profiles: RegistryProfileType[] = [];
	for (const id of ids) {
		const existingProfile = profilesReducer?.registryProfiles?.find(
			(profile: RegistryProfileType) => profile.id === id
		);
		if (existingProfile) profiles.push(existingProfile);
	}

	return profiles;
}

export async function getAndUpdateRegistryProfiles(ids: string[]): Promise<RegistryProfileType[]> {
	const existingProfiles = getExistingRegistryProfiles(ids);
	let profiles = [...existingProfiles];
	const missingProfileIds = ids.filter((id) => !existingProfiles.some((profile) => profile.id === id));

	if (missingProfileIds.length > 0) {
		const newProfileIds = missingProfileIds.filter((id) => !fetchQueue.has(id));
		newProfileIds.forEach((id) => fetchQueue.add(id));

		if (newProfileIds.length > 0) {
			console.log('Fetching missing profiles...');
			try {
				const newProfiles = await getRegistryProfiles({ profileIds: newProfileIds });
				profiles = [...profiles, ...newProfiles];

				profiles = profiles.reduce((uniqueProfiles, profile) => {
					if (!uniqueProfiles.some((p) => p.id === profile.id)) {
						uniqueProfiles.push(profile);
					}
					return uniqueProfiles;
				}, [] as RegistryProfileType[]);

				const profilesReducer = store.getState().profilesReducer;
				store.dispatch(
					profilesActions.setProfiles({
						...(profilesReducer ?? {}),
						registryProfiles: [
							...(profilesReducer?.registryProfiles || []),
							...newProfiles.filter(
								(profile) => !profilesReducer?.registryProfiles?.some((p: RegistryProfileType) => p.id === profile.id)
							),
						],
					})
				);
			} finally {
				newProfileIds.forEach((id) => fetchQueue.delete(id));
			}
		}
	}

	return profiles;
}

export async function handleProfileRegistryCache(args: { profileIds: string[] }): Promise<RegistryProfileType[]> {
	return lock.acquire('handleProfileRegistryCache', async () => {
		try {
			const state = store.getState().profilesReducer;
			let { registryProfiles = [], missingProfileIds = [], lastUpdate = 0 } = state;

			const isCacheValid = Date.now() - lastUpdate < TTL_MS;

			/*
			The cache is too old, update all the profiles again
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
					uniqueProfiles.push({
						id: profile?.ProfileId,
						username: profile?.Username || null,
						avatar: profile?.ProfileImage || null,
						bio: profile?.Description ?? null,
					});
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
			console.error('Error in handleProfileRegistryCache:', e);
			throw new Error(e.message);
		}
	});
}
