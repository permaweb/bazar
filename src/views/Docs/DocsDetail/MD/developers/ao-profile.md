## AO Profile

#### Overview

[AO Profile](https://github.com/permaweb/permaweb-libs/blob/91b6eae09e7567fadcb9d49edea9f9bd63f31174/services/src/profiles/profile.lua) is a protocol built on the permaweb designed to allow users to create an identity, interact with applications built on AO, operate as a smart wallet, and serve as a personal process. Instead of a wallet address owning assets or having uploads, the profile will encompass this information. This means that certain actions require first interacting with the profile, validating that a wallet has authorization to carry it out, and finally the profile will send a message onward to other processes, which can then validate its request.

A separate [Profile Registry aggregation process](https://github.com/permaweb/permaweb-libs/blob/91b6eae09e7567fadcb9d49edea9f9bd63f31174/services/src/profiles/registry000.lua) is used to keep track of the new profile processes that are created, as well as any updates. This registry process will serve as an all encompassing database that can be queried for profile data. You can read profile metadata directly from the AO Profile process, or from the registry.

#### Creating a profile process and setting metadata

AO Profile functions by spawning a new personal process for a user if they decide to make one. The wallet that spawns the profile is authorized to make changes to it. Prior to creating a process, you should check if the wallet address already has any profiles.

Here is an overview of actions that take place to create an AO Profile process and update the metadata:

1. A new process is spawned with the base AO module. ([Sample Code](https://cookbook_ao.arweave.net/references/ao.html#spawn))
2. A Gateway GraphQL query is executed for the spawned transaction ID in order to find the resulting process ID.
3. The [profile.lua](https://github.com/permaweb/permaweb-libs/blob/91b6eae09e7567fadcb9d49edea9f9bd63f31174/services/src/profiles/profile.lua) source code is then loaded from Arweave, and sent to the process as an eval message. This loads the state and handlers into the process.
4. Client collects Profile metadata in the data object, and uploads a banner and cover image.
5. Finally, a message is sent to update the Profile metadata.

#### Fetching profile metadata

##### By profile ID

If you have the Profile ID already, you can easily read the metadata directly from the Profile process via the `Info` handler.

#### By wallet address

If you have a wallet address, you can look up the profile(s) associated with it by interacting with the Profile Registry via the `Get-Profiles-By-Address` handler. ([Sample Code](https://github.com/permaweb/ao-bazar/blob/6ac0e3df68386535bb497445f6209b985845977b/src/api/profiles.ts#L40))

#### Profile registry process

The Profile Registry process collects and aggregates all profile metadata in a single database and its process ID is defined in all AO Profiles. Messages are sent from the Profiles to the Registry when any creations or edits to metadata occur, and can be trusted by the msg.From address which is the Profile ID.

The overall process looks like:

1. A message is sent with an action of `Update-Profile` to the Profile process with the information that the creator provided.
2. Once the Profile metadata is updated internally in the Profile Process, a new message is then sent to the Registry process to add or update the corresponding profile accordingly via its own `Update-Profile` handler.

**How to implement**

See the following implementation details for how to integrate AO profiles.

```js
import { createDataItemSigner } from '@permaweb/aoconnect';
import { aos } from '@permaweb/aoconnect';
import { AO } from 'helpers/config';
import { getProfileById, getProfilesByAddress } from 'api/profiles';

// Check if wallet already has a profile
async function checkExistingProfile(walletAddress) {
	try {
		const profiles = await getProfilesByAddress({ address: walletAddress });
		if (profiles && profiles.length > 0) {
			return profiles[0]; // Return the first profile
		}
		return null;
	} catch (e) {
		console.error('Error checking for existing profile:', e);
		return null;
	}
}

// Create a new profile
async function createProfile(walletAddress, profileData) {
	try {
		// Step 1: Spawn a new process for the profile
		const processId = await aos.spawn({
			module: AO.module,
			scheduler: AO.scheduler,
			signer: createDataItemSigner(globalThis.arweaveWallet),
			tags: [
				{ name: 'Profile-Version', value: '0.3' },
				{ name: 'Wallet-Address', value: walletAddress },
				{ name: 'Content-Type', value: 'application/json' },
				{ name: 'Type', value: 'profile' },
			],
			data: JSON.stringify({
				walletAddress: walletAddress,
				createdAt: Date.now(),
			}),
		});

		// Step 2: Wait for process to be created
		let fetchedProfileId;
		let retryCount = 0;
		while (!fetchedProfileId) {
			await new Promise((r) => setTimeout(r, 2000));
			try {
				const gqlResponse = await getGQLData({
					gateway: GATEWAYS.goldsky,
					ids: [processId],
					tagFilters: null,
					owners: null,
					cursor: null,
					reduxCursor: null,
					cursorObjectKey: null,
				});

				if (gqlResponse && gqlResponse.data.length) {
					fetchedProfileId = gqlResponse.data[0].node.id;
					console.log('Profile process created:', fetchedProfileId);
				} else {
					retryCount++;
					if (retryCount >= 10) {
						throw new Error('Transaction not found after 10 attempts, profile creation failed');
					}
				}
			} catch (e) {
				console.error(e);
			}
		}

		// Step 3: Fetch and evaluate profile process handlers
		let processSrc;
		try {
			const processSrcFetch = await fetch(getTxEndpoint(AO.profileSrc));
			if (processSrcFetch.ok) {
				processSrc = await processSrcFetch.text();
			}
		} catch (e) {
			console.error('Error fetching profile source:', e);
			throw e;
		}

		const evalMessage = await aos.message({
			process: processId,
			signer: createDataItemSigner(globalThis.arweaveWallet),
			tags: [{ name: 'Action', value: 'Eval' }],
			data: processSrc,
		});

		await aos.result({
			message: evalMessage,
			process: processId,
		});

		// Step 4: Update profile metadata
		const updateMessage = await aos.message({
			process: processId,
			signer: createDataItemSigner(globalThis.arweaveWallet),
			tags: [{ name: 'Action', value: 'Update-Profile' }],
			data: JSON.stringify({
				username: profileData.username,
				bio: profileData.bio,
				walletAddress: walletAddress,
				avatar: profileData.avatarTxId,
				banner: profileData.bannerTxId,
			}),
		});

		await aos.result({
			message: updateMessage,
			process: processId,
		});

		return processId;
	} catch (e) {
		console.error('Error creating profile:', e);
		throw e;
	}
}

// Fetch profile by ID
async function fetchProfile(profileId) {
	try {
		const profile = await getProfileById({ profileId });
		return profile;
	} catch (e) {
		console.error('Error fetching profile:', e);
		return null;
	}
}

// Update existing profile
async function updateProfile(profileId, profileData) {
	try {
		const updateMessage = await aos.message({
			process: profileId,
			signer: createDataItemSigner(globalThis.arweaveWallet),
			tags: [{ name: 'Action', value: 'Update-Profile' }],
			data: JSON.stringify({
				username: profileData.username,
				bio: profileData.bio,
				avatar: profileData.avatarTxId,
				banner: profileData.bannerTxId,
			}),
		});

		await aos.result({
			message: updateMessage,
			process: profileId,
		});

		return true;
	} catch (e) {
		console.error('Error updating profile:', e);
		throw e;
	}
}
```
