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

## Validation

```sh
npm run build
npm test
git diff --check
```

The purchase workflow stores signed transactions and deterministic recovery
metadata locally until live process state proves completion. Reloading does not
sign or pay twice.

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
