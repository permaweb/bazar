# Bazar 2.0 — Unattended Task Status

## Isolated worktrees for this task

- **Bazar application:** `/Users/sam/.codex/worktrees/bazar-2-arweave-native-20260730`
  - Branch: `feat/arweave-native-marketplace`
  - Base: `ed511d9cdec2ab76b11423e1eac392b794915444` (`main`)
- **HyperBEAM runtime:** `/Users/sam/.codex/worktrees/bazar-2-hyperbeam-20260730`
  - Detached at `35c41dfb86b6b369cd5d9e52978976f778b091c3`
    (`feat/name-token`)
  - Runtime/test base only; no edits planned
- **Token device:** `/Users/sam/.codex/worktrees/bazar-2-token-device-20260730`
  - Branch: `feat/arweave-swap-assets`
  - Base: `2125c08` (`main`)

## Mission — verbatim

Thanks. Please now turn your attention to a new task:

- Please make yourself a worktree of the Bazar atomic asset marketplace. There is a checkout in `~/src/bazar`.
- Your mission in unattended mode is to: Please modify Bazar such that it is focused on trading Arweave-scheduled (`~arweave-scheduler@1.0`), Arweave-native swapped (`swap-device: arweave-swap@1.0`) token-compatible (`~/src/devices/token@1.0`) assets.
- Assessment criteria: You will implement the **entire** system, end-to-end, *without any gaps* and *without over-engineering*. Re-use as much of the existing infrastructure and components as you can, as well as the same weave-wrangler/AO-Site-style payments flow -- just as you did for name re-sales in `~/src/ao-site`. Before halting you MUST demonstrate, collecting screenshots of the entire process end-to-end, multiple parties buying and selling assets from one another in both of the collections described below. Your finished product before halting will be Bazar 2.0 as a fully-functional on-chain, decentralized marketplace.
- The initial 'collections' of assets will be all available `~carrier@1.0` names, just like in the AO-Site, as well as two randomly generated PNG collections with 100 assets each. You should upload these with '[TEST]' somewhere in their collection name. I would suggest using the `~/src/devices/reference@1.0` device (to load into your HB just add a `trusted-devices/reference@1.0: ImplementationID`, as `arweave.net/~meta@1.0/info/trusted-devices` does) as your collection indexes in the new system. The new image asset collections should be constructed as `device: ~process@1.0` messages with `execution-device: token@1.0`, `swap-device: arweave-swap@1.0`, and `scheduler-device: arweave-scheduler@1.0`.
- When you need AR to test with (it will be the only base-pair currency for now), please use `~/src/Documents/hyperbeam-key.json`. Do not exceed a budget of 50 AR (ideally much less than that).
- You MUST add zero backend servers that the site is dependent upon -- instead, like AO-Site it should load from any HyperBEAM gateway, and perform its compute requests on `GET /ProcessIDRelativePaths`.
- You MUST change existing devices only **precisely minimally**. You will depend upon the same HyperBEAM `feat/name-token` branch as a base (starting a new worktree if you have to modify it at all), and `~/src/devices/token@1.0`. You may need to replicate the `swap-device` pattern from `~carrier@1.0` into `~token@1.0`, but this is likely the only base-layer device edit that will be required.
- Please re-use the transaction syncing screen from `AO-Site` and the weave-wrangler library below it to ensure that while the user waits for the message to sync, they have a clear understanding of what is happening.
- Please remove all 'profile' functionality from the system cleanly and fully, such that end-user wallets become the true owners of assets directly.
- Please ensure that all legacynet AO-Connect push behaviors (etc.) are completely removed, and we are left with only the clean purchase, offer, transfer APIs of the new devices. I would recommend removing the AO-Connect library entirely so that you can be sure that you have found all of the places that it could show up.
- Finally, please deep clean (purge would be a better word!) all of the old 'announcements', 'migration', etc., references in the site. Ensure that every single screen is clean, clear, and usable. You are not testing unless you are taking and looking at screenshots to see how the app is working from the user perspective. The bar here is that the UX is clean, clear, and beautiful. The network syncing may take some time but the user is never left guessing what is happening. Additionally, error/refresh recovery should be smooth and clean.

This will be an extremely intense and complex overnight task. It is also highly important. You must be patient and do not rush. Take as long as it takes. You MUST not stop until it is absolutely and fully completed. Please begin by ensuring that this full message is in your STATUS.md verbatim, along with ensuring that your isolated worktrees for this task are clearly labelled at the top of the file. Re-read this document in FULL every time your context compacts, or when you are unsure how to proceed, or believe that you have completed the task. Iterate relentlessly until every single requirement above is met.

Continue now in overnight unattended mode. Godspeed!

## Current state

- The Bazar application has been rebuilt as a browser-only marketplace for
  Arweave-scheduled, Arweave-native swap assets. The replacement is 6,965
  source lines and builds 123 modules versus the baseline's 35,788 lines and
  1,499 modules.
- The minimal `token@1.0` composition change is committed independently as
  `7f686b3` on `feat/arweave-swap-assets`. Its complete 39-test packaged-device
  run, `rebar3 device verify`, and `rebar3 device package` passed.
- The carrier-name collection is discovered from Arweave using the current
  AO-Site mechanism and contains 16,653 live candidates. It is paged rather
  than eagerly computed.
- Two permanent 100-piece test collections were generated, uploaded, and
  indexed through `reference@1.0`:
  - `[TEST] Permanent Strata`:
    `A7TGD0bktXYkQSrz4UWfPqgcb8A4TAOEsKQU5_zAu7g` →
    `8aITB5SF-jc9MXx9IuCe_RaAoOrUHkkvgsy0cmLNCQw`
  - `[TEST] Weave Signals`:
    `IMKioUfmOrqtTnrLO3_Jpg5zv8zg8PKjWYNVhD3xsZM` →
    `EK3bWZ0yvkYZ8btaPw0q-fNWsKLUeOeq3blqhRQlQJg`
- The complete publication ledger contains exactly 200 PNG transactions, 200
  process transactions, two manifests, two references, and funding. Exact
  publication/funding spend was 6.607545696784 AR; all marketplace/control
  actions including the inventory extension totalled 1.235823878375 AR.
  Combined spend is 7.843369575159 AR, far below the 50 AR limit.
- Two independent parties completed reciprocal browser-driven sales in both
  collections, including listing, registration, exact native-AR payment,
  five-confirmation observer consensus, scheduler application, reload
  recovery, and return sale:
  - `1uTLV5GvfQ5M46Tq_DTeJL7rIy7vCAOMxQ7Fbf82YZw`
  - `BLyLiOZptmb-olB8wycvk_ynHiu1SZMKPqswx4KONwc`
- Final live state at Arweave tip 1,970,053 proves Permanent Strata #001 is
  owned by party A and Weave Signals #001 by party B; both order books are
  empty and both settled at scheduler height 1,970,043.
- Final owner and responsive browser evidence:
  - `.run-data/screenshots/e2e-final-strata-owner-party-a.png`
  - `.run-data/screenshots/e2e-final-signals-owner-party-b.png`
  - `.run-data/screenshots/e2e-strata-party-a-return-purchase-applied.png`
  - `.run-data/screenshots/e2e-signals-party-b-return-purchase-applied.png`
- Production build, all 17 application tests, script syntax checks, dependency
  validation, `git diff --check`, and forbidden-surface scans pass. No
  AOConnect, profile, UCM, Redux, announcement, migration, service-worker,
  backend, mocked telemetry, or machine-specific source path remains.
- The selected HyperBEAM gateway performs both process computation and browser
  observer relays. The purchase observer fanout is bounded at 12 to preserve
  responsive local and remote gateway operation while retaining independent
  quorum evidence.
- The full browser-visible flow remains recoverable across refreshes without
  re-signing: only transaction IDs and deterministic purchase metadata are
  persisted; live computed state remains marketplace truth.

## Mission extension — verbatim

Thank you. Being careful to ensure that your solution is robust but not over-engineered, please commit your work on branches as necessary and then implement and test the following fully:

Add a fast, backend-free `/my-assets` (“My assets”) page. Discover candidate process IDs with one paginated Arweave GraphQL using aliases for: assets whose initial-holder is the connected wallet; register-interest or make-offer transactions signed by it; and transfer transactions whose recipient tag names it. Reuse AO-Site’s traditional carrier discovery where required. Deduplicate candidates, restrict them to supported collections/devices, then compute live state through the selected HyperBEAM gateway with bounded concurrency. Only live state determines ownership; GraphQL is candidate discovery.

Reuse the existing asset cards and state helpers, grouping results into “Owned” and “Listed for sale.” Render progressively starting with the assets with the most recent activity, show resolution progress, support retry, and abort cleanly on wallet/gateway changes. Do not scan entire collections, persist marketplace truth, add profiles/backends, or request a signature. Add “My assets” to the connected-wallet header. Validate with both test parties: purchases and transfers must move assets between their pages, listings must appear under “Listed,” refresh must preserve correct results, and sold assets must disappear.

Finally, collection pages must be able to be filtered for only assets that have a live listing, and sorted by recent activity or 'Default' (as you have it now).

Focus on making sure that even with very large asset groups, the UI is clean, simple, and fast to load. List a number of test assets for sale before returning. Once you are certain that you have finished commit your work again.

## Mission extension status

- The completed Bazar 2.0 baseline is committed as `aae26f8`.
- `/my-assets` now uses one paginated GraphQL operation with aliases for
  `initial-holder`, wallet-signed `register-interest`/`make-offer`, and
  recipient-tagged transfers.
- Immutable creation tags eliminate unsupported initial candidates before
  compute. The remaining candidates resolve progressively, newest first,
  through eight bounded live-state workers. No marketplace result is persisted.
- The page groups reused asset cards under `Owned` and `Listed for sale`,
  reports discovery/resolution progress, retries cleanly, and aborts on route,
  wallet, or gateway changes. A browser navigation at 65/102 live resolutions
  produced no stale-state or abort error.
- Collection pages expose `All assets`/`Listed for sale` and
  `Default`/`Recent activity`. Image activity queries are scoped to the 100
  collection process recipients. The names listing query discovers only
  `make-offer` candidates globally, then verifies their live state.
- Real-network browser validation completed with these exact transfer/listing
  actions:
  - Permanent Strata #002, party A → party B:
    `QGDk3Z0niQiH9fUV84z_hblB_V6FhFqqVSvwsOZUXz8`
  - Weave Signals #002, party B → party A:
    `tAgkXN0V7RceSLJCWFGWvEJwRCZokKH4y7SHCVwwkUc`
  - list Permanent Strata #001:
    `S09vnf099nqn8oACEJhdZGI3SCQ8vWVMFgkLRFel_iE`
  - list Permanent Strata #003:
    `JuHOTT0-YJpqj18fmEiQUJu8JCHiLrXPcFTBsVb8ID0`
  - list Weave Signals #001:
    `XdqyEKOj0p5wJGbAJ2kMbVo6DQLFk1wGrPulefje97A`
  - list Weave Signals #003:
    `LZwFzF5FrXGGoBJmm2A9ani1axx_ZZmNenO1335UzyE`
- Both parties then bought the other collection's #003 asset through the full
  browser payment flow:
  - Party B bought Permanent Strata #003:
    - reservation:
      `M68KpEwj8zw9OgL-5oe_DuMPE4ZOdDJ4JtE1EtMltes`
    - exact 0.0001 AR payment:
      `XLByXT_hHsu5H8JK0I3ocxVgHcLmReiIM9Q5amtadJc`
  - Party A bought Weave Signals #003:
    - reservation:
      `hNBxEJmaYudWOVI5iTMkw2etuCLd4IPwUInau0WeTtM`
    - exact 0.0001 AR payment:
      `q333GVTMP-2pLlmykThZVxil6jy-t55VNvYVRzEmErA`
  - both reservations mined at 1,970,087; both payments mined at 1,970,098;
    both dialogs reported `Applied to live asset state` at tip 1,970,109.
- Final live computed state proves:
  - Permanent Strata #001 remains an open listing by party A;
  - Weave Signals #001 remains an open listing by party B;
  - Permanent Strata #003 is unlisted and owned by party B;
  - Weave Signals #003 is unlisted and owned by party A.
- Both `/my-assets` pages resolve 103 candidate processes to 99 `Owned` and one
  `Listed for sale`. The sold #003 disappears from its seller and appears for
  its buyer. A true page reload and wallet restoration reproduced the same
  results for both parties without signing.
- Final collection tests prove:
  - each live-listing filter returns only the remaining #001 listing;
  - the sold #003 is absent;
  - `Recent activity` puts the newly settled #003 first;
  - `Default` restores #001-first manifest order.
- Browser evidence:
  - `.run-data/screenshots/purchase-signals-party-a-applied.png`
  - `.run-data/screenshots/purchase-strata-party-b-applied.png`
  - `.run-data/screenshots/my-assets-party-a-after-purchases.png`
  - `.run-data/screenshots/my-assets-party-b-after-purchases.png`
  - `.run-data/screenshots/collection-strata-live-listings.png`
  - `.run-data/screenshots/collection-signals-live-listings.png`
- The live transfer test exposed one precise token-device defect: Arweave tag
  values deliver `quantity` as a binary (`<<"1">>`), while `transfer/3`
  required an integer. `dev_token` now normalizes numeric wire values with
  `hb_util:safe_int/1`, covered by a packaged end-to-end owner-transfer
  regression. All 40 packaged device tests, `rebar3 device verify`, and
  `rebar3 device package` pass. The minimal fix is committed as `0542eaf` on
  `feat/arweave-swap-assets`.
- Final application gates pass: 17/17 Vitest tests, TypeScript, production Vite
  build (124 modules), dependency validation, `git diff --check`, forbidden
  legacy/backend scans, and the real two-wallet browser acceptance run.
- Extension actions cost 0.616632651529 AR including both 0.0001 AR payments.
  Combined mission spend remains 7.843369575159 AR, below the 50 AR ceiling.

## Product surface

Bazar 2.0 is a browser-only marketplace where an Arweave wallet directly owns
the traded units. A user can:

1. choose any HyperBEAM gateway;
2. browse the carrier-name collection and two `[TEST]` image collections;
3. inspect asset content, ownership, and the live AR order;
4. list an owned asset, cancel an unreserved listing, transfer it, or buy it;
5. watch every submitted transaction propagate, confirm, and enter scheduled
   process state without being left at an unexplained spinner;
6. refresh or reopen the site and resume any incomplete purchase safely.

There is no profile, intermediary owner, UCM process, legacynet message unit,
AO-Connect push path, or application backend.

## Boundaries

- **Application scope:** Bazar may be rewritten and deep-cleaned freely against
  the contract above. Existing visual atoms and useful asset renderers should be
  retained when they fit.
- **Kernel scope:** HyperBEAM is substrate. Work from `feat/name-token`; change
  it only if a concrete device/runtime defect blocks the contract.
- **Device scope:** `token@1.0` may receive only the smallest changes necessary
  to compose with `arweave-swap@1.0` and seed an on-chain one-unit asset. The
  existing carrier, scheduler, swap, and reference devices otherwise remain
  unchanged.
- **Network scope:** Public uploads explicitly required by the mission are
  allowed. Production node configuration changes are not implied.
- **Funds:** `/Users/sam/src/Documents/hyperbeam-key.json`; hard ceiling 50 AR.
  Record before/after balances and every uploaded transaction. Prefer the
  smallest practical spend.
- **Processes:** Do not stop or modify services not started for this task. Tear
  down task-local nodes and development servers when validation finishes.

## Public contracts

### Asset process

- Arweave transaction message with:
  - `device: ~process@1.0`
  - `execution-device: token@1.0`
  - `swap-device: arweave-swap@1.0`
  - `scheduler-device: arweave-scheduler@1.0`
  - `scheduler-mode: all`
  - one indivisible initial unit held directly by an Arweave wallet
  - immutable display metadata identifying collection, name, and PNG data
- Browser reads through `GET /<process-id>/<relative-path>`.
- Token actions: `transfer`.
- Swap actions: `make-offer`, `cancel-order`, `register-interest`, followed by
  an ordinary native AR payment to the seller carrying `order-id`.
- Live ownership and orders come from scheduled process state, not an indexer
  database or browser cache.

### Collection

- A `reference@1.0` value is the durable collection index.
- The referenced value contains collection metadata and the ordered asset
  process IDs.
- The names collection merges all available `carrier@1.0` assets discovered
  from Arweave with the same manifest/carrier mechanism AO-Site uses.
- Collection discovery must be possible from Arweave/HyperBEAM alone.

### Transaction synchronization

- Use the current `weave-wrangler` state machine and AO-Site transaction-sync
  visualization.
- Persist only resumable transaction IDs and deterministic purchase metadata.
- Do not cache marketplace truth.
- Never dispatch the payment until the registration satisfies the configured
  network propagation/confirmation threshold.
- Explain propagation, confirmation, scheduler inclusion, failures, and safe
  recovery in the UI.

## Baseline evidence

- Bazar base: `ed511d9cdec2ab76b11423e1eac392b794915444`
  (`main`, 2026-07-30 checkout).
- Source: 412 files, 35,788 lines under `src`.
- Largest module:
  `src/views/Asset/AssetAction/AssetActionMarket/AssetActionMarketOrders/AssetActionMarketOrders.tsx`
  at 1,725 lines.
- Legacy dependencies include `@permaweb/aoconnect`,
  `@permaweb/aoprofile`, `@permaweb/libs`, `@permaweb/ucm`, Redux persistence,
  and the AO Sync provider.
- Profile state spans routes, two providers, Redux, wallet UI, asset ownership,
  collections, orders, and campaign screens.
- `package.json` has no functional test command: `"test": "npm test"` recurses.
- Existing write APIs use `helpers/aoconnect` in legacy mode.
- Baseline production build passed:
  `npm run build:production` (`vite v6.4.3`, 1,499 modules). The largest output
  chunk was 16.86 MB uncompressed / 4.59 MB gzip.
- Baseline UI screenshots:
  - `.run-data/screenshots/baseline-home.png`
  - `.run-data/screenshots/baseline-home-full.png`
  The landing page is dominated by old promotional collections and exposes a
  profile-shaped wallet control; this is replacement evidence, not a target to
  preserve.
- HyperBEAM base worktree already exists at `/Users/sam/src/hb-name-token`,
  branch `feat/name-token`, commit
  `35c41dfb86b6b369cd5d9e52978976f778b091c3`.
- Current network `reference@1.0` implementation:
  `dRkm83Whq0qNE6We0oekl9Ngymgb7y3Otr-Smlatn54`, read from
  `https://arweave.net/~meta@1.0/info/trusted-devices`.
- Current standalone `token@1.0` source:
  `/Users/sam/src/devices/token-1.0`, commit
  `2125c08` on `main`.

## Immediate audit findings

- `arweave-swap@1.0` already implements the complete escrow/reservation/native
  AR settlement contract and is covered by extensive device tests.
- `carrier@1.0` already demonstrates the required scalar `swap-device`
  composition pattern.
- Standalone `token@1.0` does not currently delegate scheduled assignments to
  its configured swap device, and its on-chain process definition has no scalar
  initial-holder seeding path. These are the two minimal device changes now
  implemented in its task worktree.
- Existing token ledgers canonicalize account keys, while
  `arweave-swap@1.0` settles against exact, case-sensitive L1 signer addresses.
  Swap-configured token ledgers must therefore preserve exact keys. The existing
  canonical behavior remains unchanged for every token without `swap-device`.
- The existing Bazar application cannot be incrementally stripped with
  confidence: its profiles, UCM/AO writes, Redux persistence, providers,
  routes, and views are mutually coupled. The selected deep-clean strategy is
  a clean application-surface replacement retaining only fitting visual assets
  and the proven AO-Site/weave-wrangler transaction system. See
  `decisions/application-rebuild.md`.
- The carrier namespace bootstrap is the current Arweave manifest
  `fQXYPE9MAcfI1wV2CwJ3sJIhgT9btBOlYFOKFDGhAs0`, containing 16,621 names.
  Collection browsing must page/search this index and compute only viewed
  details or live offer candidates; eagerly computing every name is forbidden.
- Image collection indexes will be `reference@1.0` init messages whose scalar
  `reference-value` points at an immutable JSON collection manifest. This
  matches the device's documented foreign-message pattern without inventing a
  backend or a nested on-chain encoding.
