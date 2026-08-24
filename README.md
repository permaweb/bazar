# Bazar 2.0

Bazar is a browser-only marketplace for one-unit Arweave assets. Wallets own
assets directly, offers and transfers execute in their Arweave-scheduled
processes, and purchases settle in native AR.

There is no marketplace backend, identity intermediary, hosted order book, or
legacy AO message service. The application reads immutable collection indexes
from Arweave and computes live asset state through any HyperBEAM gateway.

## Asset contract

A tradable process uses:

-   `device: ~process@1.0`
-   `execution-device: token@1.0`
-   `swap-device: arweave-swap@1.0`
-   `scheduler-device: arweave-scheduler@1.0`
-   `scheduler-mode: all`
-   `total-supply: 1`
-   `initial-holder: <wallet address>`

New assets are atomic at creation: the process transaction body is the primary
media itself, while its process configuration, ANS-110 discoverability fields,
and optional UDL terms are transaction tags. The asset/process ID is therefore
also the media transaction ID. Optional album artwork for audio is an ancillary
transaction referenced by `asset-artwork`, matching Bazar Studio's cover-art
model. Older assets with a separate `asset-data` transaction remain readable.

The write API is deliberately small:

-   `transfer`
-   `make-offer`
-   `cancel-order`
-   `register-interest`, followed by a native AR payment bearing the `order-id`

Collections are `process@1.0` processes executed by `carrier@1.0`. Each process
starts with an immutable JSON manifest and lets its holder publish a signed
`set` pointing at a later manifest when assets are added. Carrier names are discovered directly from Arweave
GraphQL and paged in the browser.

## Wallet inventory

`#/my-assets` discovers a wallet's possible assets with one paginated,
aliased Arweave GraphQL query. It combines initial holdings, signed market
actions, and incoming transfers, then computes only those candidates through
the selected AO transport with bounded concurrency. GraphQL is never
treated as ownership or listing truth.

Results appear progressively in `Owned` and `Listed for sale` groups. Changing
the connected wallet, AO transport, or AO peer pool aborts the previous resolution. The
page is read-only and never requests a signature.

Collection pages can retain their manifest order or sort by recent on-chain
activity. The live-listings filter discovers offer candidates and verifies
their current order state without computing every asset in the collection.

Each collection also exposes a backend-free activity view. It queries recent
signed market actions scoped to that collection's process IDs and links each
event to its permanent transaction. The activity feed is historical context;
ownership, availability, and the order book still come exclusively from live
process state.

Asset pages render the current one-unit order book and any UDL/license fields
present in the process state. Missing license metadata is shown as absent
rather than inferred.

## Development

```sh
npm install
npm run start
```

Vite serves the application on `http://127.0.0.1:3000` by default. When the PermawebOS
browser extension is available, Bazar uses its injected `window.aoFetch` singleton
by default, sharing AO Wrangler peer and rate-limit state with other applications.
The AO Core control in the header can disable that transport and use Bazar's own
AO Wrangler singleton instead. Its ordered fallback peer list defaults to Alpha
and Charlie and can also be supplied with `VITE_COMPUTE_GATEWAY` or a comma-separated
`node` query parameter:

```text
http://127.0.0.1:3000/?node=https://alpha.example,https://charlie.example#/asset/…
```

Applying the header control persists the peer list and transport selection in the
page URL. Bazar does not silently switch to its local fallback after a request has
been sent through PermawebOS; local AO Wrangler is selected only when PermawebOS is
unavailable or the user disables it.

Arweave API requests use the gateway serving the site. During local development
they fall back to `https://arweave.net`; set `VITE_ARWEAVE_GATEWAY` or append the advanced
`arweave-node` query parameter when another Arweave gateway is required:

```text
http://127.0.0.1:3000/?arweave-node=http://127.0.0.1:1984#/asset/…
```

The AO peer pool and Arweave gateway selection are independent. Transactions
are signed by the connected wallet and submitted through the selected Arweave gateway.

### HyperBEAM device configuration

The published `token@1.0` implementation is
`TmTc-Tjo8WWrp6Th8Kgqs7azjIKHgyNIcvZ6NW-zvps`. A standard
`feat/name-token` node should pin it together with the devices it composes:

```json
{
	"trusted-devices": {
		"process-outbox@1.0": "HOcPV7wxMHYb3rSQ3EfykQhHx_b8waRWhXolhcBNgHo",
		"reference@1.0": "dRkm83Whq0qNE6We0oekl9Ngymgb7y3Otr-Smlatn54",
		"security@1.0": "ARgymad5oYZcWPpxuV-A9hoSgmm4ElgPIvxMwmeh674",
		"token@1.0": "TmTc-Tjo8WWrp6Th8Kgqs7azjIKHgyNIcvZ6NW-zvps"
	}
}
```

## Validation

```sh
npm run build
npm test
git diff --check
```

The purchase workflow stores signed transactions and deterministic recovery
metadata locally until live process state proves completion. Reloading does not
sign or pay twice.

## Deployment

Build and publish the static application with a JSON Arweave key in
`DEPLOY_KEY`:

```sh
DEPLOY_KEY="$(jq -c . /path/to/key.json)" npm run deploy:main
```

The deployment command prints the immutable Arweave manifest ID. No service is
deployed because the build is entirely static.

### Stable test deployment address

Bazar can place every immutable deployment behind one `~reference@1.0`
address. Initialize the reference once after an immutable deployment:

```sh
DEPLOY_KEY="$(jq -c . /path/to/key.json)" npm run reference:init
```

This creates a permanent, wallet-controlled reference whose public ID is saved
in the ignored `.run-data/site-reference.json`. Back up that public reference
ID. On another machine, provide it as `BAZAR_REFERENCE_ID`; the wallet remains
the authority and must never be committed.

The normal `npm run deploy:main` workflow is unchanged: it publishes an
immutable manifest and does not move any reference or name. For reference
testing, `npm run deploy:reference` uploads the immutable manifest and then
updates the test reference exactly once. Preview a signed reference item
without posting it:

```sh
DEPLOY_KEY="$(jq -c . /path/to/key.json)" npm run reference:set -- --dry-run
```

Reference updates are permanent public ANS-104 items sent directly to the
Mystical HyperBEAM bundler with `bundler-subject: body`; they do not use Turbo.
The test reference does not update `bazar.arweave.net`. The stable URL can take
several minutes to reflect a newly accepted target.

## Test collections

The repository includes deterministic generation and publication scripts for
two 100-piece PNG collections. Generated data, test wallets, and publication
ledgers live under the ignored `.run-data/` directory; private keys are never
committed.

```sh
python scripts/generate_test_collections.py
node scripts/publish_collection_media.mjs
node scripts/publish_asset_processes.mjs
node scripts/fund_test_parties.mjs
```

Publication scripts read `~/src/Documents/hyperbeam-key.json` by default. Set
`BAZAR_TEST_WALLET` to use a different local key file.

The legacy test-publication scripts still describe their historical two-step
media/process fixtures. Assets created through the application use the atomic
single-transaction layout described above.

## License

ISC
