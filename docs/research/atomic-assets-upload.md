# Atomic asset upload model: protocol and Bazar Studio findings

Research date: 2026-08-10

## Conclusion

The user's intuition is directionally correct: an atomic asset's primary identifier should identify both the content and the tradeable token/process. The first-party AO [Atomic Assets draft specification](https://github.com/permaweb/permaweb-libs/blob/358e6b2094e0288a43550046a28bb56b4a6d03ec/specs/spec-atomic-assets.md#L1-L52) defines it as an AO token process and its data stored together in one Arweave transaction. The document is still explicitly a **Draft**, version **0.0.1**. [Bazar Studio's own documentation](https://github.com/permaweb/bazar-studio/blob/f5f7f3bbeb5396384b4d3b2c761fb13bbff20850/src/views/Docs/DocsDetail/MD/overview/core-concepts.md#L5-L13) describes the data, metadata, and smart contract as one inseparable transaction.

In the current Bazar Studio implementation, the file bytes are the **data of the AO process spawn itself**. The returned process ID is therefore also the content ID. Bazar Studio does **not** first upload the primary media and then create a process that points at the media transaction.

It is still imprecise to say that the complete lifecycle is literally one Arweave base-layer transaction:

-   The identity-bearing asset is one signed AO process data item containing the media, metadata tags, and process envelope. `aoconnect.spawn()` returns that item's ID as the process ID. AO data items can be bundled into another Arweave transaction, so an indexed item is not necessarily a standalone layer-1 transaction. The pinned `aoconnect` implementation explicitly accepts `data` on `spawn`, appends the AO process envelope, uploads the item, and returns its process ID. [AO `spawn` contract](https://github.com/permaweb/ao/blob/f0624f16d3a21d577e577760a632e978dbe7c383/connect/src/lib/spawn/index.js#L13-L38), [AO process upload](https://github.com/permaweb/ao/blob/f0624f16d3a21d577e577760a632e978dbe7c383/connect/src/lib/spawn/upload-process.js#L30-L112)
-   `@permaweb/libs` sends a separate `Init` message immediately after the spawn. That message initializes/notifies runtime state; it is not a second copy of the media and does not become the asset's identifier. [`aoSpawn`](https://github.com/permaweb/permaweb-libs/blob/254500999c458e1e892f834bb0f7c0bf3908ecb8/sdk/src/common/ao.ts#L17-L46)
-   Bazar Studio uploads optional audio cover art separately and stores its transaction ID in the asset's bootloader metadata. Such an audio asset has an atomic primary audio/process item plus an external artwork reference. [Bazar Studio cover-art path](https://github.com/permaweb/bazar-studio/blob/f5f7f3bbeb5396384b4d3b2c761fb13bbff20850/src/views/Upload/index.tsx#L301-L324)
-   Collections are separate processes/messages which group independently atomic asset IDs; “atomic” does not mean an entire collection and all its files share one transaction.

The published [Tradeable Atomic Asset 1.0.0 specification](https://atomic-assets.arweave.net/) is useful for the original principle but is not the implementation to copy for current Bazar Studio compatibility. It describes the older SmartWeave/Warp model: media bytes and SmartWeave contract tags (`SmartWeaveContract`, `Contract-Src`, `Init-State`, `Contract-Manifest`) are uploaded together through Bundlr and registered with Warp. The page itself warns that its example may no longer work. Current Bazar Studio instead creates an AO process with an `On-Boot` program and bootloader tags. In short: **the site's definition is relevant; its concrete deployment recipe is legacy for this task.**

## What Bazar Studio actually does

Bazar Studio pins `@permaweb/aoconnect` and `@permaweb/libs` 0.0.85 and initializes a legacy AO connection with the connected-wallet signer. [Bazar Studio dependencies](https://github.com/permaweb/bazar-studio/blob/f5f7f3bbeb5396384b4d3b2c761fb13bbff20850/package.json#L18-L25), [provider initialization](https://github.com/permaweb/bazar-studio/blob/f5f7f3bbeb5396384b4d3b2c761fb13bbff20850/src/providers/PermawebProvider.tsx#L23-L40)

For each selected file, Studio:

1. Reads the file as an `ArrayBuffer`/`Buffer`.
2. Builds an asset object with the raw bytes in `data`, the file MIME type in both `contentType` and `assetType`, and creator/name/description/topics/supply/transferability fields.
3. Adds collection, traits, media-specific metadata, and license tags when selected.
4. Calls `createAtomicAsset(asset)` and treats the returned value as the asset ID.

The relevant source is [Studio's asset construction and call](https://github.com/permaweb/bazar-studio/blob/f5f7f3bbeb5396384b4d3b2c761fb13bbff20850/src/views/Upload/index.tsx#L264-L357), with the byte conversion in [`fileToBuffer`](https://github.com/permaweb/bazar-studio/blob/f5f7f3bbeb5396384b4d3b2c761fb13bbff20850/src/helpers/utils.ts#L172-L183).

`@permaweb/libs` serializes JSON content only when the content type is JSON; otherwise it preserves the supplied file bytes. It builds the tags, then passes **both those tags and those same bytes** to `aoCreateProcess`, whose return value is the asset ID. [`createAtomicAssetWith`](https://github.com/permaweb/permaweb-libs/blob/254500999c458e1e892f834bb0f7c0bf3908ecb8/sdk/src/services/assets.ts#L14-L62)

Conceptually, the object is:

```text
asset/process ID
├── data: raw primary file bytes
├── Content-Type: the primary file MIME type
├── discoverability + license tags
├── bootloader tags: initial token state and metadata
└── AO envelope: process module, scheduler, authority, protocol, and type
```

That is the important “atomic” property: fetching the process ID yields the content, while computing that same ID yields the token state.

## Exact Bazar Studio process inputs

The IDs below are the defaults in `@permaweb/libs` 0.0.85, the exact version pinned by the inspected Bazar Studio commit:

| Role             | Value                                         | Meaning in this implementation                                                                                                                            |
| ---------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AO WASM module   | `ISShJH1ij-hPPt9St5UFFr_8Ys3Kj5cyg7zrMGt7H9s` | Runtime module passed to `spawn`; this is not the asset contract source.                                                                                  |
| Scheduler        | `_GQ33BkPtZrqxA84vM8Zk-N2aO0toNNu_C-l-rawrBA` | Legacy AO scheduler passed to `spawn`, unless a configured node overrides it.                                                                             |
| Authority        | `fcoN_xJeisVsPXA-trzVAuIiqO3ydLQxM-L4XbrQKzY` | Default MU/authority tag used when no node-specific authority is configured. It is infrastructure authority, not the asset owner or initial token holder. |
| `On-Boot` source | `c7Gsg31LTwgclh_pXxZp90Pqr2WC9R4U1RISt5_AzFc` | Lua atomic-asset/token program loaded at process boot.                                                                                                    |

The defaults are defined in [`helpers/config.ts`](https://github.com/permaweb/permaweb-libs/blob/254500999c458e1e892f834bb0f7c0bf3908ecb8/sdk/src/helpers/config.ts#L1-L17). `aoCreateProcess` chooses the module/scheduler, while `aoSpawn` adds `Authority` and `Process-Timestamp`. [`aoCreateProcessWith`](https://github.com/permaweb/permaweb-libs/blob/254500999c458e1e892f834bb0f7c0bf3908ecb8/sdk/src/common/ao.ts#L445-L482), [`aoSpawn`](https://github.com/permaweb/permaweb-libs/blob/254500999c458e1e892f834bb0f7c0bf3908ecb8/sdk/src/common/ao.ts#L17-L31)

The asset-specific tags built by version 0.0.85 are:

| Tag                       | Required/default behavior                                                                                                              |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `On-Boot`                 | Atomic-asset Lua source ID above, unless the caller supplies another `src`.                                                            |
| `Creator`                 | Bazar Studio passes the connected user's **profile process ID**, not the wallet address.                                               |
| `Asset-Type`              | Required; Studio sets it to the file MIME type.                                                                                        |
| `Content-Type`            | Required; the primary file MIME type, which also makes direct gateway delivery correct.                                                |
| `Implements`              | `ANS-110`.                                                                                                                             |
| `Date-Created`            | Millisecond Unix timestamp.                                                                                                            |
| `Bootloader-Name`         | Asset name.                                                                                                                            |
| `Bootloader-Description`  | Asset description.                                                                                                                     |
| `Bootloader-Topics`       | JSON-encoded array of topic strings.                                                                                                   |
| `Bootloader-Ticker`       | `ATOMIC`.                                                                                                                              |
| `Bootloader-Denomination` | Supplied denomination or default `1`.                                                                                                  |
| `Bootloader-TotalSupply`  | Supplied supply or default `1`.                                                                                                        |
| `Bootloader-Transferable` | Supplied flag or default `true`.                                                                                                       |
| `Bootloader-Creator`      | Same profile process ID as `Creator`.                                                                                                  |
| `Bootloader-*`            | Each caller metadata entry is mapped to process case and included here; for example `collectionId` becomes `Bootloader-Collection-Id`. |
| `Auth-Users`              | Optional JSON array.                                                                                                                   |
| Custom/license tags       | Appended unchanged after the core tags.                                                                                                |

This exact construction is in [`buildAssetCreateTags`](https://github.com/permaweb/permaweb-libs/blob/254500999c458e1e892f834bb0f7c0bf3908ecb8/sdk/src/services/assets.ts#L161-L190); required call arguments are defined in [`AssetCreateArgsType`](https://github.com/permaweb/permaweb-libs/blob/254500999c458e1e892f834bb0f7c0bf3908ecb8/sdk/src/helpers/types.ts#L86-L103).

`aoconnect` then supplies the AO protocol envelope, including `Variant=ao.TN.1`, `Type=Process`, `Module`, `Scheduler`, and `SDK=aoconnect`; the AO protocol tag utility supplies the protocol association. [Pinned `aoconnect` uploader](https://github.com/permaweb/ao/blob/f0624f16d3a21d577e577760a632e978dbe7c383/connect/src/lib/spawn/upload-process.js#L30-L112)

The permanent [`On-Boot` source](https://arweave.net/c7Gsg31LTwgclh_pXxZp90Pqr2WC9R4U1RISt5_AzFc), also preserved in the versioned [`process_asset.lua` source](https://github.com/permaweb/permaweb-libs/blob/254500999c458e1e892f834bb0f7c0bf3908ecb8/services/src/process_asset.lua#L660-L751), reads `Bootloader-*` tags from the spawn item, maps token fields into token state and other fields into metadata, and assigns the entire `TotalSupply` balance to `Token.Creator`. Its `Init` handler notifies that creator/profile about the uploaded asset. This establishes an important ownership distinction:

-   the wallet signs and therefore owns the process data item;
-   `Authority` names AO infrastructure;
-   `Creator`/`Bootloader-Creator` is the profile process that receives the initial token balance in Studio's flow.

Those roles must not be collapsed when porting the behavior.

### Live network confirmation

As a check against source-code interpretation, Arweave GraphQL was queried on 2026-08-10 for items with `On-Boot=c7Gsg31LTwgclh_pXxZp90Pqr2WC9R4U1RISt5_AzFc`. The returned item [`mEY4llsc5mPZ-f5q2Z3fEh28QkcC098ZQyiTRyjrCzY`](https://arweave.net/mEY4llsc5mPZ-f5q2Z3fEh28QkcC098ZQyiTRyjrCzY) serves an 86,075-byte JPEG directly and carries the expected asset, bootloader, license, module, scheduler, authority, and AO-process tags. GraphQL reports that item as bundled in `I9YSEQQP2B-OZYeZboxxrCAMNP3TsnewN9y2e1Nk6dM`. This confirms the qualifier above: the content/process has one immutable item ID, while that item can live inside a distinct top-level bundle transaction.

### License tags in Studio

Studio adds the UDL transaction ID in `License`, an xU token ID in `Currency`, and optional `Access-Fee`, `Derivations`, `Commercial-Use`, `Data-Model-Training`, `Payment-Mode`, and `Payment-Address` tags. [Studio license builder](https://github.com/permaweb/bazar-studio/blob/f5f7f3bbeb5396384b4d3b2c761fb13bbff20850/src/views/Upload/index.tsx#L498-L555), [Studio tag constants](https://github.com/permaweb/bazar-studio/blob/f5f7f3bbeb5396384b4d3b2c761fb13bbff20850/src/helpers/config.ts#L126-L189)

Do not blindly replace this repo's existing UDL vocabulary with the old atomic-assets site example. The old page uses still older names/values, and Studio itself uses plural `Derivations` while this repo's UDL 0.2 implementation uses singular `Derivation`. License normalization should be treated as a separate compatibility decision from making the asset payload atomic.

## How this repo differs today

At base commit [`e68cd56`](https://github.com/permaweb/bazar/tree/e68cd56d62362da1e31444119a70d27e419fc428), this repo implements a different HyperBEAM-native token/swap process model:

1. It creates and posts a media transaction whose data is the file bytes.
2. For audio, it optionally creates and posts a second artwork transaction.
3. It creates and posts a process transaction whose data is JSON metadata and whose `asset-data`/`asset-artwork` tags point to the earlier IDs.

That sequence is explicit in [`AssetMintClient.mint` and `resume`](https://github.com/permaweb/bazar/blob/e68cd56d62362da1e31444119a70d27e419fc428/src/api/asset-mint.ts#L172-L275). The process tags use `device=process@1.0`, `execution-device=token@1.0`, `swap-device=arweave-swap@1.0`, `scheduler-device=arweave-scheduler@1.0`, and an initial holder wallet address. [`mintProcessTags`](https://github.com/permaweb/bazar/blob/e68cd56d62362da1e31444119a70d27e419fc428/src/api/asset-mint.ts#L577-L612)

The UI accurately exposes the split: two signatures for image assets and three for audio plus artwork. [Create UI](https://github.com/permaweb/bazar/blob/e68cd56d62362da1e31444119a70d27e419fc428/src/routes/CreateRoute.tsx#L886-L895)

This means the current asset is a tradeable token process with immutable referenced media, but it is **not atomic under the one-identifier packaging definition**: the process ID does not serve the media, and the media ID does not compute the token state.

## Compatibility gaps an implementation must close

An atomic rewrite is broader than changing one upload call:

1. **Upload and cost model.** The raw file must become the identity-bearing process payload. The estimate becomes one primary asset upload rather than media reward plus small JSON process reward, and the wallet should sign once per image asset. Large-file chunk upload must operate on the process transaction/data item itself.
2. **Content delivery.** `Content-Type` on the process item must be the media MIME type. Rendering should use the process ID directly as the primary content URL rather than resolving `asset-data`.
3. **Metadata placement.** JSON fields currently stored in the process body must move to tags or another state-readable initialization mechanism because the body becomes raw media bytes.
4. **Discovery.** Current discovery requires an `asset-data` 43-character pointer and this repo's HyperBEAM device tags. It would reject a Studio-style AO asset. [`atomicProcessNode`](https://github.com/permaweb/bazar/blob/e68cd56d62362da1e31444119a70d27e419fc428/src/api/asset-discovery.ts#L1280-L1298)
5. **State reader/trading compatibility.** Studio's legacy Lua token state is not the same contract as this repo's `token@1.0` plus `arweave-swap@1.0` device stack. An exact transplant of Studio tags/process IDs would require adapting the state reader, discovery, ownership, listing, transfer, and purchase paths. Merely adding `On-Boot` tags would not preserve current marketplace behavior.
6. **Ownership semantics.** Studio initializes balances to a profile process ID; this repo initializes to the connected wallet. The desired holder must be chosen explicitly and all wallet asset discovery must agree with it.
7. **Resume/error behavior.** The current mint draft exists because media can succeed before process creation fails. One identity-bearing item removes that split failure boundary; draft state and UI phases should be simplified accordingly.
8. **Audio artwork.** Keeping Studio's separate cover-art convention is interoperable but means “all bytes in one item” is only true of the primary audio. Strict whole-asset atomicity would need a manifest/container payload and would no longer serve the audio MIME directly.
9. **Collections.** Per-asset transaction/signature counts change, but collection manifest/index or collection-process operations remain separate from the atomic assets they group.
10. **Tests and copy.** Tests currently assert `asset-data` pointers, separate upload calls, and two/three wallet signatures. Receipt links, progress phases, estimates, recovery copy, and discovery fixtures all encode the split design.

## Recommended target for this repo

Use Bazar Studio's **packaging invariant**, not automatically its entire legacy runtime stack:

> The primary file bytes, discoverability/license metadata, and executable token-process declaration share one signed identifier; that identifier is both the gateway content URL and the process ID.

There are then two viable protocol choices:

### A. Exact Bazar Studio AO compatibility

Spawn the legacy AO process with the pinned module/scheduler/authority/`On-Boot` values and Studio's bootloader tags, put raw bytes in `spawn.data`, send `Init`, and move marketplace readers/trading flows to that Lua asset contract. This produces assets matching Studio's indexed shape, but it is the larger migration and reintroduces a legacy AO dependency path that this repo currently does not use.

### B. HyperBEAM-native atomic packaging

Keep the repo's `process@1.0` + `token@1.0` + swap/scheduler devices, but make the process transaction body the raw media and make its `Content-Type` the media MIME. Move description and other initialization data to tags/state, treat the process ID as its own media URL, and remove the external `asset-data` requirement. This preserves the current trading architecture while adopting the same one-identifier invariant. It is the smaller coherent change, but it should be called a HyperBEAM-native atomic asset rather than claimed as byte-for-byte Bazar Studio compatibility until cross-app discovery is tested.

Given the current repo's extensive device-specific marketplace and verification logic, option B is the safer architectural fit unless exact Bazar Studio interoperability is the overriding requirement. Whichever option is selected, the acceptance test should prove all three properties with one ID:

1. `GET /<asset-id>` returns the original bytes with the original MIME type.
2. Computing `<asset-id>` returns a valid one-of-one token state with the intended initial holder.
3. Bazar discovery, ownership, listing, transfer, and purchase paths accept that same ID without consulting a separate primary-media transaction.
