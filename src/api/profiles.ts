import { readHandler } from 'api';

import { PROCESSES } from 'helpers/config';
import { ProfileHeaderType, RegistryProfileType } from 'helpers/types';

export async function getProfile(args: { address: string }): Promise<ProfileHeaderType | null> {
	const emptyProfile = {
		id: null,
		walletAddress: args.address,
		displayName: null,
		username: null,
		bio: null,
		avatar: null,
		banner: null,
	};

	try {
		const profileLookup = await readHandler({
			processId: PROCESSES.profileRegistry,
			action: 'Get-Profiles-By-Address',
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
				return {
					id: activeProfileId,
					walletAddress: args.address,
					displayName: fetchedProfile.Profile.DisplayName || null,
					username: fetchedProfile.Profile.Username || null,
					bio: fetchedProfile.Profile.Bio || null,
					avatar: fetchedProfile.Profile.Avatar || null,
					banner: fetchedProfile.Profile.Banner || null,
				};
			} else return emptyProfile;
		} else return emptyProfile;
	} catch (e: any) {
		throw new Error(e);
	}
}

export async function getRegistryProfiles(args: { profileIds: string[] }): Promise<RegistryProfileType[]> {
	try {
		const metadataLookup = await readHandler({
			processId: PROCESSES.profileRegistry,
			action: 'Get-Metadata-By-ProfileIds',
			data: { ProfileIds: args.profileIds },
		});

		if (metadataLookup && metadataLookup.length) {
			return metadataLookup.map((profile: { ProfileId: string; Username: string }) => {
				return { id: profile.ProfileId, username: profile.Username, avatar: null };
			});
		}

		return [];
	} catch (e: any) {
		throw new Error(e);
	}
}
