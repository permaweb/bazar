## AO Collections

[AO collections](https://github.com/permaweb/permaweb-libs/blob/91b6eae09e7567fadcb9d49edea9f9bd63f31174/specs/spec-collections.md#L4) are designed to allow users to group atomic assets together. The creation of a collection happens with these steps:

1. The [collection process handlers](https://arweave.net/e15eooIt86VjB1IDRjOMedwmtmicGtKkNWSnz8GyV4k) are fetched from Arweave.
2. Collection fields are replaced with the values submitted by the user.
3. A new process is spawned, with the collection tags.
4. A message is sent to the newly created process with an action of 'Eval', which includes the process handlers.
5. A message is sent to the collections registry to register the new collection.

**How to implement**

See the following implementation details for how to create atomic asset collections.

```js
import { createDataItemSigner } from '@permaweb/aoconnect';
import { aos } from '@permaweb/aoconnect';
import { AO } from 'helpers/config';
import { getTxEndpoint } from 'helpers/utils';

// Fetch collection process handlers
let processSrc;
try {
	const processSrcFetch = await fetch('https://arweave.net/e15eooIt86VjB1IDRjOMedwmtmicGtKkNWSnz8GyV4k');
	if (processSrcFetch.ok) {
		processSrc = await processSrcFetch.text();
	}
} catch (e) {
	console.error(e);
}

// Create collection tags
const collectionTags = [
	{ name: 'Data-Protocol', value: 'Collection' },
	{ name: 'Collection-Name', value: collectionName },
	{ name: 'Creator', value: arProvider.profile.id },
	{ name: 'Title', value: collectionName },
	{ name: 'Description', value: collectionDescription },
	{ name: 'Type', value: 'collection' },
	{ name: 'Content-Type', value: 'application/json' },
];

// Add banner and thumbnail if available
if (bannerTxId) {
	collectionTags.push({ name: 'Banner', value: bannerTxId });
}
if (thumbnailTxId) {
	collectionTags.push({ name: 'Thumbnail', value: thumbnailTxId });
}

// Spawn the collection process
const processId = await aos.spawn({
	module: AO.module,
	scheduler: AO.scheduler,
	signer: createDataItemSigner(globalThis.arweaveWallet),
	tags: collectionTags,
	data: JSON.stringify({
		name: collectionName,
		description: collectionDescription,
		banner: bannerTxId || null,
		thumbnail: thumbnailTxId || null,
		creator: arProvider.profile.id,
	}),
});

// Wait for process to be confirmed
let fetchedCollectionId;
let retryCount = 0;
while (!fetchedCollectionId) {
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
			fetchedCollectionId = gqlResponse.data[0].node.id;
		} else {
			retryCount++;
			if (retryCount >= 10) {
				throw new Error('Transaction not found after 10 attempts, collection creation failed');
			}
		}
	} catch (e) {
		console.error(e);
	}
}

// Evaluate the process handlers
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

// Register the collection with the registry
const registerMessage = await aos.message({
	process: AO.collectionsRegistry,
	signer: createDataItemSigner(globalThis.arweaveWallet),
	tags: [
		{ name: 'Action', value: 'Add-Collection' },
		{ name: 'Collection-Id', value: processId },
		{ name: 'Collection-Name', value: collectionName },
	],
	data: JSON.stringify({
		id: processId,
		name: collectionName,
		description: collectionDescription,
		banner: bannerTxId || null,
		thumbnail: thumbnailTxId || null,
		creator: arProvider.profile.id,
		dateCreated: Date.now(),
	}),
});

await aos.result({
	message: registerMessage,
	process: AO.collectionsRegistry,
});
```
