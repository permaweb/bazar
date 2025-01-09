import AsyncLock from 'async-lock';

import { connect } from '@permaweb/aoconnect';
import AOProfile, { RegistryProfileType } from '@permaweb/aoprofile';

import { readHandler } from 'api';

import { AO } from 'helpers/config';
import { store } from 'store';
import * as profilesActions from 'store/profiles/actions';

const TTL_MS = 10 * 60 * 1000;

const lock = new AsyncLock();

let registryFetchQueue: Set<string> = new Set();

const { getRegistryProfiles } = AOProfile.init({ ao: connect() });

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

	const REGISTRY_TTL = 2 * 24 * 60 * 60 * 1000;

	const outdatedOrMissingProfileIds = ids.filter((id) => {
		const profile = existingProfiles.find((profile) => profile.id === id);
		return !profile || (profile.lastUpdate && Date.now() - Number(profile.lastUpdate) > REGISTRY_TTL);
	});

	if (outdatedOrMissingProfileIds.length > 0) {
		const newProfileIds = outdatedOrMissingProfileIds.filter((id) => !registryFetchQueue.has(id));
		newProfileIds.forEach((id) => registryFetchQueue.add(id));

		if (newProfileIds.length > 0) {
			try {
				const newProfiles = await getRegistryProfiles({ profileIds: newProfileIds });
				profiles = [...profiles.filter((profile) => !outdatedOrMissingProfileIds.includes(profile.id)), ...newProfiles];

				profiles = profiles.reduce((uniqueProfiles, profile) => {
					if (!uniqueProfiles.some((p) => p.id === profile.id)) {
						uniqueProfiles.push(profile);
					}
					return uniqueProfiles;
				}, [] as RegistryProfileType[]);

				// Get current Redux state
				const profilesReducer = store.getState().profilesReducer;
				const currentRegistryProfiles = profilesReducer?.registryProfiles || [];

				// Find profiles that are new or have changed
				const updatedProfiles = newProfiles.filter((newProfile) => {
					const existingProfile = currentRegistryProfiles.find((p) => p.id === newProfile.id);
					return (
						!existingProfile || // New profile
						JSON.stringify(existingProfile) !== JSON.stringify(newProfile) // Updated profile
					);
				});

				// Only dispatch if there are updates
				if (updatedProfiles.length > 0) {
					store.dispatch(
						profilesActions.setProfiles({
							...(profilesReducer ?? {}),
							registryProfiles: [
								...currentRegistryProfiles.filter(
									(profile) => !updatedProfiles.some((p: RegistryProfileType) => p.id === profile.id)
								),
								...updatedProfiles,
							],
						})
					);
				}
			} finally {
				newProfileIds.forEach((id) => registryFetchQueue.delete(id));
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
						thumbnail: profile?.ProfileImage || null,
						description: profile?.Description ?? null,
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
						thumbnail: profile?.ProfileImage || null,
						description: profile?.Description ?? null,
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
						thumbnail: profile?.ProfileImage || null,
						description: profile?.Description ?? null,
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
					thumbnail: profile?.ProfileImage || null,
					description: profile?.Description ?? null,
				};
			});
		} catch (e: any) {
			console.error('Error in handleProfileRegistryCache:', e);
			throw new Error(e.message);
		}
	});
}
