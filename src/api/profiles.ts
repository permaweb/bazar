import { getGQLData, readHandler } from 'api';

import { AR_PROFILE, GATEWAYS, PAGINATORS, PROCESSES, TAGS } from 'helpers/config';
import { getTxEndpoint } from 'helpers/endpoints';
import {
	AOProfileType,
	DefaultGQLResponseType,
	FullProfileType,
	GQLNodeResponseType,
	ProfileType,
} from 'helpers/types';
import { getTagValue } from 'helpers/utils';

export async function getProfile(args: { address: string }): Promise<AOProfileType | null> {
	const emptyProfile = {
		id: null,
		walletAddress: null,
		displayName: null,
		username: null,
		bio: null,
		avatar: null,
		banner: null,
	};

	const profileLookup = await readHandler({
		processId: PROCESSES.profileRegistry,
		action: 'Get-Profiles-By-Address',
		data: { Address: args.address },
	});

	// TODO: get active profile from registry
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
				displayName: fetchedProfile.DisplayName || null,
				username: fetchedProfile.Username || null,
				bio: fetchedProfile.Bio || null,
				avatar: fetchedProfile.Avatar || null,
				banner: fetchedProfile.Banner || null,
			};
		} else return emptyProfile;
	} else return emptyProfile;
}

export async function getProfiles(args: { addresses: string[]; profileVersions?: string[] }): Promise<ProfileType[]> {
	let profiles: ProfileType[] = [];
	let gqlData: GQLNodeResponseType[] = [];

	const profileVersions = args.profileVersions ? args.profileVersions : [TAGS.values.profileVersions['1']];

	for (let i = 0; i < args.addresses.length; i += PAGINATORS.default) {
		const gqlResponse: DefaultGQLResponseType = await getGQLData({
			gateway: GATEWAYS.arweave,
			ids: null,
			tagFilters: [
				{
					name: TAGS.keys.protocolName,
					values: profileVersions,
				},
			],
			owners: args.addresses.slice(i, i + PAGINATORS.default),
			cursor: null,
		});

		gqlData = [...gqlData, ...gqlResponse.data];
	}

	profiles = args.addresses.map((address: string) => {
		const emptyProfile = {
			txId: null,
			displayName: null,
			handle: null,
			avatar: null,
			walletAddress: address,
			profileIndex: null,
			banner: null,
		};

		const addressProfiles = gqlData.filter((element: GQLNodeResponseType) => {
			return element.node.owner.address === address;
		});

		if (addressProfiles && addressProfiles.length) {
			const gqlProfile = addressProfiles
				.sort((a: GQLNodeResponseType, b: GQLNodeResponseType) => {
					const aIndex = getTagValue(a.node.tags, TAGS.keys.dateCreated);
					const bIndex = getTagValue(b.node.tags, TAGS.keys.dateCreated);
					return parseInt(aIndex !== null ? aIndex : '0') - parseInt(bIndex !== null ? bIndex : '0');
				})
				.reverse()[0];

			let currentIndex = '0';
			const profileIndex = getTagValue(gqlProfile.node.tags, TAGS.keys.profileIndex);
			if (profileIndex !== null) currentIndex = profileIndex;

			let displayName = null;
			const displayNameTag = getTagValue(gqlProfile.node.tags, TAGS.keys.displayName);
			if (displayNameTag !== null) displayName = displayNameTag;

			let handle = null;
			let handleTag = getTagValue(gqlProfile.node.tags, TAGS.keys.handle);
			if (handleTag !== null) handle = handleTag;
			else {
				handleTag = getTagValue(gqlProfile.node.tags, TAGS.keys.handle.toLowerCase());
				if (handleTag !== null) handle = handleTag;
			}

			let avatar = null;
			const avatarTag = getTagValue(gqlProfile.node.tags, TAGS.keys.avatar);
			if (avatarTag !== null) avatar = avatarTag.replace('ar://', '');

			let banner = null;
			const bannerTag = getTagValue(gqlProfile.node.tags, TAGS.keys.banner);
			if (bannerTag !== null) banner = bannerTag.replace('ar://', '');

			if (gqlProfile) {
				return {
					txId: gqlProfile ? gqlProfile.node.id : null,
					displayName: displayName,
					handle: handle,
					avatar: avatar,
					walletAddress: address,
					profileIndex: currentIndex,
					banner: banner,
				};
			} else {
				return emptyProfile;
			}
		} else {
			return emptyProfile;
		}
	});

	return profiles;
}

export async function getCurrentProfile(args: { address: string }): Promise<ProfileType | null> {
	try {
		const fetchedProfiles = await getProfiles({ addresses: [args.address] });
		if (fetchedProfiles && fetchedProfiles.length) return fetchedProfiles[0];
		else return null;
	} catch (e: any) {
		console.error(e);
		return null;
	}
}

export async function getFullProfile(args: { address: string }): Promise<FullProfileType> {
	const emptyProfile = {
		txId: null,
		displayName: null,
		handle: null,
		avatar: null,
		walletAddress: args.address,
		profileIndex: null,
		banner: null,
		bio: null,
	};
	try {
		const currentProfile = await getCurrentProfile({ address: args.address });
		if (currentProfile && currentProfile.txId) {
			const response = await fetch(getTxEndpoint(currentProfile.txId));
			if (response && response.ok) {
				const responseJson = await response.json();

				let avatar = null;
				if (responseJson.avatar) {
					if (responseJson.avatar.replace('ar://', '') === AR_PROFILE.defaultAvatar) avatar = null;
					else avatar = responseJson.avatar;
				}

				let banner = null;
				if (responseJson.banner) {
					if (responseJson.banner.replace('ar://', '') === AR_PROFILE.defaultBanner) banner = null;
					else banner = responseJson.banner;
				}

				const fullProfile = {
					txId: currentProfile.txId,
					displayName: responseJson.displayName ?? null,
					handle: responseJson.handle ?? null,
					avatar: avatar,
					walletAddress: args.address,
					profileIndex: responseJson.profileIndex ?? currentProfile.profileIndex ?? 1,
					banner: banner,
					bio: responseJson.bio ?? null,
				};
				return fullProfile as FullProfileType;
			} else {
				return emptyProfile;
			}
		} else {
			return emptyProfile;
		}
	} catch (e: any) {
		console.error(e);
		return emptyProfile;
	}
}
