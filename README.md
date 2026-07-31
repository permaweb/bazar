# Bazar 2.0

Bazar is a browser-only marketplace for one-unit Arweave assets. Wallets own
assets directly, offers and transfers execute in their Arweave-scheduled
processes, and purchases settle in native AR.

There is no marketplace backend, identity intermediary, hosted order book, or
legacy AO message service. The application reads immutable collection indexes
from Arweave and computes live asset state through any HyperBEAM gateway.

## Asset contract

A tradable process uses:

- `device: ~process@1.0`
- `execution-device: token@1.0`
- `swap-device: arweave-swap@1.0`
- `scheduler-device: arweave-scheduler@1.0`
- `scheduler-mode: all`
- `total-supply: 1`
- `initial-holder: <wallet address>`

The write API is deliberately small:

- `transfer`
- `make-offer`
- `cancel-order`
- `register-interest`, followed by a native AR payment bearing the `order-id`

Collection indexes are immutable JSON manifests addressed through
`reference@1.0`. Carrier names are discovered directly from Arweave GraphQL and
paged in the browser.

## Wallet inventory

`#/my-assets` discovers a wallet's possible assets with one paginated,
aliased Arweave GraphQL query. It combines initial holdings, signed market
actions, and incoming transfers, then computes only those candidates through
the selected HyperBEAM gateway with bounded concurrency. GraphQL is never
treated as ownership or listing truth.

Results appear progressively in `Owned` and `Listed for sale` groups. Changing
the connected wallet or compute gateway aborts the previous resolution. The
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

Vite serves the application on `http://127.0.0.1:3000` by default. Select a
compute gateway in the header or append a `node` query parameter:

```text
http://127.0.0.1:3000/?node=http://127.0.0.1:3101#/asset/…
```

The query parameter selects process computation and the HyperBEAM relay used
for browser-safe checks against independent Arweave nodes. Transactions are
signed by the connected wallet and submitted to the Arweave network.

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

The media and asset processes are separate permanent transactions: the small
JSON process body remains valid token state while `asset-data` points to the
full-resolution PNG.

## License

ISC
