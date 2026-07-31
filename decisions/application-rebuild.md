# Application rebuild

## Prompt

Turn the legacy Bazar application into a browser-only Bazar 2.0 for directly
wallet-owned Arweave-scheduled token and carrier assets. Remove profiles,
AO-Connect, UCM, announcements, migrations, and all legacy push behavior.
Reuse AO-Site's native transaction/payment flow and synchronization UI.

## Issue

The existing 35,788-line application is organized around profiles, UCM/AO
push messages, campaign/promotional surfaces, Redux persistence, and several
legacy SDKs. Ownership, routing, marketplace writes, and most presentation
components assume those contracts. Removing only their visible controls would
leave the old authority and write paths in the bundle.

The useful public contract is much smaller:

- immutable collection indexes on Arweave;
- process state read from the selected HyperBEAM gateway;
- offers discovered on Arweave and verified against process state;
- native Arweave transactions signed by the connected wallet;
- resumable `weave-wrangler` synchronization; and
- direct wallet ownership.

## Options

1. Incrementally adapt all legacy providers, reducers, routes, and views.
   This retains disallowed dependencies and makes it difficult to prove every
   old write path is gone.
2. Build the new app alongside the legacy app and leave unused files.
   This makes the runtime smaller but fails the requested purge and keeps two
   product architectures in the repository.
3. Replace the application surface cleanly, preserving only visual assets and
   atoms that fit the new contract, and copy/generalize the proven AO-Site
   transaction client, purchase state machine, and synchronization components.

## Decision

Choose option 3.

The new source tree will contain only:

- gateway/GraphQL and collection discovery clients;
- a generic one-unit asset state and marketplace client shared by carrier and
  token assets;
- browser-wallet connection and native transaction preparation;
- a generic resumable sequence operation provider for list, cancel, transfer,
  and two-transaction purchases;
- the AO-Site/weave-wrangler observer network and transaction synchronization
  visualization, generalized from name-specific labels;
- collection, asset, owned-assets, and transaction-recovery screens; and
- a small design system consistent with Bazar's black/white visual identity.

There will be no profile model, intermediary owner, AO-Connect import,
legacynet write, UCM process, app backend, service worker cache, Redux store, or
stale route. Local storage may hold only signed transaction envelopes and
resumable operation metadata; it is never marketplace truth.

The two image collection reference IDs and the established carrier namespace
reference are immutable bootstrap configuration. Each image collection
reference resolves to its Arweave collection-index transaction. The application
reads asset ownership and live orders from `GET
/<process-id>~process@1.0/now...` on the selected gateway and verifies every
GraphQL offer candidate against that state.

Validation is a production build, static dependency/source scans, browser
screenshots at desktop and narrow widths, refresh recovery, and real multi-party
Arweave trades in both carrier and image collections.
