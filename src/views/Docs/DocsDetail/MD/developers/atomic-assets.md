## Atomic Assets

**Overview**

An atomic asset is a unique digital item stored on Arweave. Unlike traditional NFTs, the asset data is uploaded together with a smart contract in a single transaction which is inseparable and does not rely on external components.

**How it works**

[AO atomic assets](https://github.com/permaweb/ao-atomic-asset/blob/main/atomic-asset.lua) follow the token spec designed for exchangeable tokens which can be found here [old\SmartWeave Spec](https://atomic-assets.arweave.dev/#:~:text=An%20atomic%20asset%20is%20a,using%20just%20this%20one%20identifier.) | [new/AO Spec](https://github.com/permaweb/ao-atomic-asset?tab=readme-ov-file). The creation of an atomic asset happens with these steps:

1. The [asset process handlers](https://arweave.net/y9VgAlhHThl-ZiXvzkDzwC5DEjfPegD6VAotpP3WRbs) are fetched from Arweave.
2. Asset fields are replaced with the values submitted by the user.
3. A new process is spawned, with the tags and asset data included.
4. A message is sent to the newly created process with an action of 'Eval', which includes the process handlers.
5. A message is sent to the profile that created the asset in order to add the new asset to its Assets table.

**How to implement**

See the following implementation details for how to create atomic assets.

```js
try {
	const processSrcFetch = await fetch(getTxEndpoint(AO.assetSrc));
	if (processSrcFetch.ok) {
		processSrc = await processSrcFetch.text();
	}
} catch (e: any) {
	console.error(e);
}

if (processSrc) {
	processSrc = processSrc.replace('[Owner]', `['${arProvider.profile.id}']`);
	processSrc = processSrc.replaceAll('<NAME>', title);
	processSrc = processSrc.replaceAll('<TICKER>', 'ATOMIC');
	processSrc = processSrc.replaceAll('<DENOMINATION>', '1');
	processSrc = processSrc.replaceAll('<BALANCE>', balance.toString());
}

const processId = await aos.spawn({
	module: AO.module,
	scheduler: AO.scheduler,
	signer: createDataItemSigner(globalThis.arweaveWallet),
	tags: assetTags,
	data: buffer,
});

let fetchedAssetId: string;
let retryCount: number = 0;
while (!fetchedAssetId) {
	await new Promise((r) => setTimeout(r, 2000));
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
		console.log(`Fetched transaction`, gqlResponse.data[0].node.id, 0);
		fetchedAssetId = gqlResponse.data[0].node.id;
	} else {
		console.log(`Transaction not found`, processId, 0);
		retryCount++;
		if (retryCount >= 10) {
			throw new Error(`Transaction not found after 10 attempts, contract deployment retries failed`);
		}
	}
}

const evalMessage = await aos.message({
	process: processId,
	signer: createDataItemSigner(globalThis.arweaveWallet),
	tags: [{ name: 'Action', value: 'Eval' }],
	data: processSrc,
});

const evalResult = await aos.result({
	message: evalMessage,
	process: processId,
});
```
