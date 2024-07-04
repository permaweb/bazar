## For developers

This guide provides all information needed to incorporate UCM on AO into your permaweb project.

- [UCM](/#/docs/developers/#universal-content-marketplace)
- [Atomic Assets](/#/docs/developers/#atomic-assets)
- [AO Collections](/#/docs/developers/#collections)
- [AO Profile](/#/docs/developers/#ao-profile)
- [Integrations](/#/docs/developers/#integrations)

#### ⚠⚠ WARNING ⚠ ⚠

**These processes are in an early development and expermintation phase. We will update these guides accordingly as processes evolve.**

## [Universal Content Marketplace (UCM)](/#/docs/developers/#universal-content-marketplace)

**Overview**

The Universal Content Marketplace (UCM) is a protocol built on the permaweb designed to enable trustless exchange of atomic assets. It empowers creators and users to interact, trade, and transact with any form of digital content, from images and music to videos, papers, components, and even applications.

**How it works**

The UCM functions by accepting a deposit from a buyer or seller and fulfilling orders based on the swap pair, quantity, and possibly price that are passed along with the deposit. Here is a list of actions that take place to complete a UCM order.

1. A user deposits (transfers) their tokens to the UCM. The user will also have to add additional tags to the **Transfer Message** which are forwarded to the UCM process and will be used to create the order.
2. The token process issues a **Credit-Notice** to the UCM and a **Debit-Notice** to the user.
3. The UCM **Credit-Notice Handler** determines if the required tags are present in order to create the order.
4. The UCM uses the forwarded tags passed to the **Transfer Handler** to submit an order to the orderbook. The order creation input includes the swap pair to execute on, as well as the quantity of tokens and price of tokens if the order is a limit order.

#### Creating orders

##### AOS

**Deposit (Transfer)**

```lua
Send({
	Target = TOKEN_PROCESS,
	Action = 'Transfer'
	Tags = {
		'Recipient' = UCM_PROCESS,
		'Quantity' = ORDER_QUANTITY,
		'X-Quantity' = ORDER_QUANTITY,
		'X-Swap-Token' = SWAP_TOKEN,
		'X-Price' = UNIT_PRICE,
		'X-Order-Action' = 'Create-Order'
	}
})
```

#### NodeJS

**Deposit (Transfer)**

```js
const response = await messageResults({
	processId: arProvider.profile.id,
	action: 'Transfer',
	wallet: arProvider.wallet,
	tags: transferTags,
	data: {
		Target: dominantToken,
		Recipient: recipient,
		Quantity: calculatedQuantity,
	},
	responses: ['Transfer-Success', 'Transfer-Error'],
	handler: 'Create-Order',
});
```

```js
const response = await message({
	process: TOKEN_PROCESS,
	signer: createDataItemSigner(global.window.arweaveWallet),
	tags: [
		{ name: 'Action', value: 'Transfer' },
		{ name: 'Recipient', value: UCM_PROCESS },
		{ name: 'Quantity', value: ORDER_QUANTITY },
		{ name: 'X-Quantity', value: ORDER_QUANTITY },
		{ name: 'X-Swap-Token', value: SWAP_TOKEN },
		{ name: 'X-Price', value: ORDER_PRICE },
		{ name: 'X-Order-Action', value: 'Create-Order' },
	],
});
```

## [Atomic Assets](/#/docs/developers/#atomic-assets)

**Overview**

An atomic asset is a unique digital item stored on Arweave. Unlike traditional NFTs, the asset data is uploaded together with a smart contract in a single transaction which is inseparable and does not rely on external components.

**How it works**

[AO atomic assets](atomic-asset.lua) follow the token spec designed for exchangeable tokens which can be found [here](https://ao.arweave.dev/#/). The creation of an atomic asset happens with these steps:

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

## [AO Collections](/#/docs/developers/#collections)

[AO collections](collection.lua) are designed to allow users to group atomic assets together. The creation of a collection happens with these steps:

1. The [collection process handlers](https://arweave.net/e15eooIt86VjB1IDRjOMedwmtmicGtKkNWSnz8GyV4k) are fetched from Arweave.
2. Collection fields are replaced with the values submitted by the user.
3. A new process is spawned, with the collection tags.
4. A message is sent to the newly created process with an action of 'Eval', which includes the process handlers.
5. A message is sent to a collection registry which contains information on all created collections.

**How to implement**

See the following implementation details for how to create atomic asset collections.

```js

```

## [AO Profile](/#/docs/developers/#ao-profile)

#### Overview

[AO Profile](profile.lua) is a protocol built on the permaweb designed to allow users to create an identity, interact with applications built on AO, operate as a smart wallet, and serve as a personal process. Instead of a wallet address owning assets or having uploads, the profile will encompass this information. This means that certain actions require first interacting with the profile, validating that a wallet has authorization to carry it out, and finally the profile will send a message onward to other processes, which can then validate its request.

A separate [Profile Registry aggregation process](registry.lua) is used to keep track of the new profile processes that are created, as well as any updates. This registry process will serve as an all encompassing database that can be queried for profile data. You can read profile metadata directly from the AO Profile process, or from the registry.

#### Creating a profile process and setting metadata

AO Profile functions by spawning a new personal process for a user if they decide to make one. The wallet that spawns the profile is authorized to make changes to it. Prior to creating a process, you should check if the [wallet address already has any profiles](#by-wallet-address).

Here is an overview of actions that take place to create an AO Profile process and update the metadata:

1. A new process is spawned with the base AO module. ([Sample Code](https://github.com/permaweb/ao-bazar/blob/main/src/components/organisms/ProfileManage/ProfileManage.tsx#L156))
2. A Gateway GraphQL query is executed for the spawned transaction ID in order to find the resulting process ID. ([Sample Code](https://github.com/permaweb/ao-bazar/blob/main/src/components/organisms/ProfileManage/ProfileManage.tsx#L168))
3. The [profile.lua](profile.lua) source code is then loaded from Arweave, and sent to the process as an eval message. This loads the state and handlers into the process. ([Sample Code](https://github.com/permaweb/ao-bazar/blob/6ac0e3df68386535bb497445f6209b985845977b/src/components/organisms/ProfileManage/ProfileManage.tsx#L191))
4. Client collects Profile metadata in the [data object](https://github.com/permaweb/ao-bazar/blob/6ac0e3df68386535bb497445f6209b985845977b/src/components/organisms/ProfileManage/ProfileManage.tsx#L70), and [uploads a banner and cover image](https://github.com/permaweb/ao-bazar/blob/6ac0e3df68386535bb497445f6209b985845977b/src/components/organisms/ProfileManage/ProfileManage.tsx#L77).
5. Finally, a message is sent to update the Profile metadata. ([Sample Code](https://github.com/permaweb/ao-bazar/blob/6ac0e3df68386535bb497445f6209b985845977b/src/components/organisms/ProfileManage/ProfileManage.tsx#L210)).

#### Fetching profile metadata

##### By profile ID

If you have the Profile ID already, you can easily read the metadata directly from the Profile process via the `Info` handler. ([Sample Code](https://github.com/permaweb/ao-bazar/blob/6ac0e3df68386535bb497445f6209b985845977b/src/api/profiles.ts#L6))

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

```
