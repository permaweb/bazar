# Bazar 2.0 — Unattended Task Status

## Isolated worktrees for this task

- **Bazar application:** `/Users/sam/.codex/worktrees/bazar-2-arweave-native-20260730`
  - Branch: `impr/recursive-ux`
  - Recursive UX base: `764bf28943f21ab038243c33aebeae952f906521`
    (published fungible build; parent branch `feat/fungible`)
- **weave-wrangler recovery contract:**
  `/Users/sam/.codex/worktrees/weave-wrangler-recursive-ux-20260804`
  - Branch: `impr/recursive-ux`
  - Base: `722b7f01832baa3f1db8a165a8994f72ba7379bc`
  - Candidates:
    - `35d30af` (`fix: distinguish terminal dispatch outcomes`)
    - `b5e12d4` (`fix: abort ambiguity waits immediately`)
    - `afaed9c` (`fix: replay exact transactions after reorgs`)
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

## Final mission — verbatim

Thank you. Now your final task for the evening: Please backport the aesthetic *style* (not the exact implementation) of the original onto your new version of Bazar. Bazar has many fans that enjoyed its UI, so we should offer them a cleaner, smoother, and fully decentralized experience -- but with a familiar aesthetic theme. Please update it slightly to be smoother, sleeker, and more modern, but still largely true to the original vibe of Bazar. That means that we want the asset listing page to look similar, too: Showing UDL/license properties if present, an orderbook (even if these *particular* assets only have one offer at a time as they have one unit), and if possible, an activity page for collections. All of the prior rules of this build still apply: Keep it clean, fast, and fully decentralized.

Once you are done, publish a version of your `token@1.0`, then demonstrate that we can load it by its implementation ID (alongside our `reference@1.0`) in a standard HyperBEAM node only running the `feat/name-token` branch. Please run your complete circuits of buying and selling assets, checking they appear in your `my-assets` page, filtering and sorting by activity on collections, and re-listing and purchasing. Once all of these components work please commit your work and then deploy the new Bazar UI itself and check it loads correctly from arweave.net (using your local HyperBEAM node with token@1.0 loaded for compute). Commander's intent: Have Bazar 2.0 ready to deploy as soon as your turn completes. We will load your `~token@1.0` onto our production nodes, then my team will start to use it.

This is the final challenge. You have done exceptionally well so far. Time to get it over the line. Stay focused. Godspeed!

## Final mission status

- Complete. The original Bazar visual vocabulary is restored in a smoother,
  responsive application without restoring profiles, UCM, AOConnect,
  announcements, migrations, backends, or any other legacy architecture.
- Published `token@1.0`, implementation-ID cold loading, two-wallet market
  circuits, live inventory recovery, collection listing/activity views, and
  Arweave production-origin validation all pass.
- Deployed Bazar manifest:
  `aoehUhJcxoKQl93_X2uXYxborLgHQReTFZ2VWHtCYhc`.

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

## Non-negotiable architecture invariant

- Nothing that depends on a custom server-side index, database, API, worker,
  or privately operated backend is admissible. The finished application must
  remain usable from Arweave and ordinary stock HyperBEAM nodes loading its
  published devices by implementation ID.
- Standard Arweave GraphQL may discover candidate transactions only. It must
  never supply marketplace truth: ownership, balances, listings, reservations,
  and settlement are accepted only from live process state computed through
  the user-selected HyperBEAM gateway.
- Immutable manifests and reference indexes belong on Arweave. Browser-local
  storage may retain only signer-scoped transaction recovery metadata, never
  shared marketplace state. If a proposed feature requires any other hosted
  component, reject or redesign it rather than adding that dependency.

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

## Final mission progress

- The modernized original-Bazar visual system is implemented with bundled
  Quantico/Inter WOFF2 fonts, the familiar cart/mountain mark, the original
  monochrome/coral palette, dot-grid surfaces, and current responsive layout.
- Collection pages now have `Assets` and backend-free `Activity` views.
  Activity is a bounded, collection-scoped Arweave GraphQL history; it is never
  treated as ownership or listing truth.
- Asset pages now render the live one-unit order book and only UDL/license
  scalar properties actually declared by process state.
- Current app validation:
  - `npm run typecheck`
  - `npm test -- --run`: 19/19 tests pass
  - `npm run build`
  - `git diff --check`
- `token@1.0` source remains the committed
  `0542eaf0067054f058fbeb5e558b47f046eb7e8b`.
  `HB_PORT=0 rebar3 device test` passed all 40 tests, including native/hyper
  parity, swap settlement, offer/cancel, transfer ownership, and wire quantity.
  `rebar3 device verify` and `rebar3 device package` also passed.
- Published once:
  - specification:
    `7LWK7RCyMKCZ1uiANJ5At1vfsiwra1T_5xkBG3X_so0`
  - implementation:
    `TmTc-Tjo8WWrp6Th8Kgqs7azjIKHgyNIcvZ6NW-zvps`
  - signer:
    `eFNj8Xo_fbPWkEFL47YgEHctsxs03jk6fSGDr_xTiFY`
- The token branch now ends at documentation commit `0b17c5f`, which records
  those published IDs; implementation source remains the tested
  `0542eaf0067054f058fbeb5e558b47f046eb7e8b`.
- A clean HyperBEAM checkout at exact `feat/name-token` commit
  `35c41dfb86b6b369cd5d9e52978976f778b091c3` is running on task port 3101.
  Its metadata reports the published token implementation and the production
  `reference@1.0` implementation
  `dRkm83Whq0qNE6We0oekl9Ngymgb7y3Otr-Smlatn54`.
  A cold computation of Strata #001 returned `execution-device: token@1.0`,
  its live escrowed order, and the exact current state without source-preloading
  the token repository.
- The two-party final circuit is in flight:
  - Party B Strata #001 registration:
    `u_jgUobBkZPiI1uNl5Qd4WA09L1YFP59TZ90CywiJ7k`
  - Party B → Party A seller payment:
    `YE9df6nXUoe9d-QB-KkxvtceR-FUzQ1AqI2tuhgEdzc`
  - Party A Signals #001 registration:
    `CSGyP7ecdUcbFqOQCwlgio9N0CVAPeCYp1OzT-iyXRs`
  - Party A → Party B seller payment:
    `4hSlysFohDhY2g8ikn45O5A19QlTQOJgjUPcloXj9Gs`
  Bazar has already demonstrated exact signed-transaction recovery after a
  wallet-context change and a compute-node restart; no transaction was signed
  twice. Each payment remained local until live state showed its matching
  scheduler reservation.
- Party B has also re-listed the already purchased Strata #003 through the UI
  at 0.0001 AR. The signed listing transaction is
  `i-59CVHojfCzMPqGFfPqB0xHWx3Gl5KzoRfV6GSsfCA`; its transaction-sync screen is
  preserved as `relist-party-b-sync.png`.
  Its preceding completed sale is independently visible as listing
  `JuHOTT0-YJpqj18fmEiQUJu8JCHiLrXPcFTBsVb8ID0`, reservation
  `M68KpEwj8zw9OgL-5oe_DuMPE4ZOdDJ4JtE1EtMltes`, and native payment
  `XLByXT_hHsu5H8JK0I3ocxVgHcLmReiIM9Q5amtadJc`; live state now names Party B
  as owner.
- Once that re-list appeared as an open live order, Party A started the
  buy-back through the rendered order book. The new registration transaction
  is `lKj6GTVlV-1Lup0_P8Y1x1-pRhtFOfGbwVBTiTqFCk0`; its native payment remains
  signed but undispatched until the scheduler reservation becomes live.
  After that exact live-state transition, Bazar released payment
  `YaQMEaaMAnpFIAlupt9bD6voG03JPOcHpTsnqLaXSwk`.
- The buy-back settled at `swap-height` 1,970,169: Party A owns Strata #003
  and the order book is empty. The asset page refreshed to that live state.
- Final, refreshed 103/103 inventory checks:
  - Party A: Signals #003 listed; Signals #001 and Strata #003 owned.
  - Party B: Strata #001 listed; transferred Strata #002 owned; sold Strata
    #003 and Signals #001 absent.
  - Evidence: `my-assets-party-a-final.png` and
    `my-assets-party-b-final.png`.
- Party A listed Signals #003 at 0.0002 AR for the final live marketplace
  inventory. Its transaction is
  `z0YQvZ3K5t7Ambyr7OjEf8A79_fLBhP6bITvb52oZfc`.
  Live Signals state now contains that open order, and the collection's
  `Listed for sale` + `Recent activity` view resolves exactly one result:
  Signals #003. Evidence: `signals-live-listing-filter.png`.
- Strata #001 settled to Party B in live state with no remaining order, proving
  the registration/payment pair above completed. Party B then re-listed that
  newly purchased asset at 0.0003 AR through the UI:
  `xPq4nbitLwypaokKrEisl0_Bul7Cfz088ef77qIcA9w`.
  Live Strata state now contains that open order at 0.0003 AR, so the final
  marketplace has open inventory in both test image collections.
- Signals #001 then settled to Party A. Fresh 103/103 live-state inventory
  resolutions showed Strata #001 under Party B and Signals #001 under Party A;
  after retrying Party B's page, the sold Signals asset and its listing
  disappeared. Corresponding screenshots are
  `my-assets-party-b-sold-disappeared.png` and
  `my-assets-party-a-after-purchase.png`.
- Current final visual evidence lives under
  `.run-data/screenshots/final-ui/`.
- The exact application build at
  `2c03841b83813387ad063d151cc0640c4cb0d10b` was published as 14 ordinary
  Arweave file transactions and a standard `arweave/paths` manifest:
  `aoehUhJcxoKQl93_X2uXYxborLgHQReTFZ2VWHtCYhc`.
  Upload cost was 0.094402935091 AR, bringing total mission spend to
  7.937772510250 AR.
- Arweave mined the manifest in block 1,970,182. A fresh production-origin
  browser session loaded the security-sandboxed Arweave URL, the bundled
  fonts/images/application chunks, and the complete Bazar home.
- A temporary GET/HEAD/OPTIONS-only HTTPS tunnel to the task-local standard
  HyperBEAM node proved that the deployed origin computes through the node
  whose trusted-device map loads published `token@1.0`. The deployed asset
  page returned the current Party B owner, 0.0003 AR open ask,
  `execution: token@1.0`, native-AR settlement, supply 1/1, and the rendered
  live order book. The tunnel was validation infrastructure only and is not
  part of Bazar.
- From the deployed build, the Strata collection's `Listed for sale` +
  `Recent activity` controls resolved exactly one current listing, and its
  Activity view rendered the permanent listing, transfer, and reservation
  transactions from both test parties.
- Production evidence:
  - `.run-data/screenshots/final-ui/deployed-arweave-live-orderbook.png`
  - `.run-data/screenshots/final-ui/deployed-arweave-collection-activity.png`

### Cold-runtime dependency control

- A never-before-requested Strata asset initially failed on the clean node
  with `device_not_loadable: security@1.0`. This was an operator-configuration
  miss, not a token implementation defect: `token@1.0` deliberately composes
  the published `security@1.0` and `process-outbox@1.0` devices documented by
  its repository.
- The clean node now pins those two published dependencies in addition to
  `token@1.0` and `reference@1.0`; no HyperBEAM or token source was changed.
- The same cold asset then computed successfully through the published token
  implementation. Its live state reports Party B as owner, matching the real
  Party A → Party B transfer
  `QGDk3Z0niQiH9fUV84z_hblB_V6FhFqqVSvwsOZUXz8`.
- A second standard node on port 3102 used a brand-new isolated store and the
  exact `feat/name-token` commit. Its metadata exposed the four pinned device
  IDs, then first-request computations of Strata #002 and Signals #002 both
  returned HTTP 200, `execution-device: token@1.0`, and their correct,
  different live owners. The control node and its temporary config were
  stopped and removed immediately afterward.

## Fungible-token mission — verbatim

In unattended mode, work from a branch from your current build called `feat/fungible` and:
- Generate a fungible token with the arweave-scheduler and swap device. It should be denominated in the 10^12 range, as Arweave and AO are.
- Modify the UI such that it supports the full end-to-end flow for listing offers, cancelling them, and making purchases of units -- including multi-order settlements.
- When we match multiple orders at once, we should claim the orders in parallel and send payments, such that it should not take meaningfully longer than a single-order purchase. For v1, you should allow the user to leaf between 'tabs' of the 3D infinity symbol to see each of their different transactions happening in parallel. Later we will produce a better visualization. This is the ONLY area of your work that you may punt some of the visual details. The rest must be beautiful, clean, clear, and functional.
- Use the screenshot tool and analyze what you see, going through multiple rounds of UX review with sub-agents until the flow is beautiful, clean, and elegant.
- Commander's intent: Implement the *complete*, fungible token flow for Bazar 2.0, with beautiful rendering and smooth UX. Acceptance: Provide full screenshots of the entire flow end-to-end working including multi-order matched settlement.

### Fungible-token execution status

- Created `feat/fungible` from Bazar commit
  `7066e8ad847004535e3e1ae945e0478979dd2a7d`.
- Published the real 12-decimal `[TEST] Weave Credit` (`WEAVE`) process
  `IyFfmbTu8P4rv0KyrA0Q-QtfEnYntMj4RkRiBVip9KA`, seeded with
  `1000000000000000000` atomic units (1,000,000 WEAVE) to party A. It uses
  `token@1.0`, `arweave-swap@1.0`, `arweave-scheduler@1.0`, and
  `scheduler-mode: all`. Upload reward was `2647978870` winston.
- The clean task HyperBEAM node on port 3101 loaded the published process and
  returned its exact token metadata and balance at Arweave block 1,972,523.
- Live browser computation exposed and fixed a lossless-JSON boundary defect:
  HyperBEAM correctly emitted the 10^18 balance, but native `response.json()`
  could not preserve it as a safe JavaScript integer. Unsafe integer lexemes
  are now retained as exact decimal strings before state parsing, with a live-
  response regression test.
- Fungible state, exact decimal formatting, deterministic bounded whole-lot
  matching, arbitrary-quantity list/transfer actions, cancellation, aggregate
  affordability preflight, and resumable parallel purchase orchestration are
  implemented. Device/runtime source remains unchanged.
- UX review round one used two independent sub-agents. Applied findings include
  a readable full-ticker hero, grouped exact quantities, correct listed-supply
  and holder semantics, a primary listing action, wider commerce layout,
  explicit amount-vs-listing matching, aggregate spend disclosure, independent
  settlement warning, and an aggregate post-settlement balance/order check.
- The first real cancellation-control listing is in flight from party A:
  `WnACXzUfdI9MHc_-K7ZmRXLyO09VKz6IE2h8zFVo1sc` (2 WEAVE at 0.000001 AR per
  WEAVE). Browser evidence so far is under `.run-data/screenshots/fungible/`.
- That listing reached five confirmations and entered live process state at
  scheduler height 1,972,525. The UI then showed party A with 999,998 liquid
  WEAVE, 2 listed WEAVE, and the exact 0.000002 AR lot in its live order book.
  The cancellation was submitted through the rendered order row as
  `iFNmpguLt2zhov5PwxOOX_CEOW5FG4E4KJIN1Cdjev0` and mined at 1,972,538.
- Two durable seller lots were signed and dispatched concurrently from
  independent browser origins while that cancellation synchronized:
  - 3 WEAVE at 0.000001 AR/unit:
    `9oNqP1sFMwgBqotYHD5iMF3EJUFWHRhKsYdStTY7SOs`
  - 5 WEAVE at 0.0000012 AR/unit:
    `P8T-Ic0j0JFMmzFd2siSa88IpwK5zkUDY62wr9G5lfk`
- A second correctness review found and reproduced an invalid fresh-batch
  resume snapshot before buyer testing (`A resumed payment requires a
  dispatched registration`). Fresh batches now hand their already-signed
  pairs directly into each new `SwapPurchase`, while crash-safe storage holds
  only the undispatched registration until the lifecycle itself publishes a
  valid payment snapshot. A constructor-level regression test covers the
  exact rejected boundary.
- Parallel payment release now has a shared barrier: every reservation is
  proven live first, one aggregate exact-balance check covers all signed seller
  payments, and only then are those payments released together. Ambiguously
  dispatched resumed payments always reuse their exact signed ID even if its
  pre-sign window elapsed, preventing a replacement native-AR transfer from
  becoming a possible duplicate. Purchase estimates also include the one-
  winston scheduler quantity. Current gates pass 36/36 tests and TypeScript.
- UX review round two was completed by a fresh sub-agent against screenshots
  01–08 and the batch implementation. Applied changes include pre-submit
  sell/transfer validation, exact operation-specific success receipts,
  whole-listing purchase language, seller-payment/network-fee/wallet-after
  quote rows, operation-specific CTAs, cancel consequences, accessible dialog
  naming/live announcements, safe continue-and-resume controls, recovery tabs,
  and exact `Reserve x/5` / `Pay x/5` progress on every parallel listing.
- Both durable listings were then reloaded from fresh browser documents after
  reaching five confirmations. Each recovered its original signed transaction
  without another wallet signature and resumed at the scheduler wait. Evidence:
  `.run-data/screenshots/fungible/08-listing-reload-recovered.png`.
- Both durable listings entered live process state together at scheduler height
  1,972,550. Party A then held 999,992 liquid WEAVE with exactly two open lots:
  3 WEAVE for 0.000003 AR and 5 WEAVE for 0.000006 AR.
- Party B matched the full 8 WEAVE through the real browser order book. The two
  reservation transactions were signed and dispatched together:
  - 3-WEAVE lot: `pNGPNKtVXynrIxzTLqOnlvC1vhsu0ul7ybMXy_a9F1Q`
  - 5-WEAVE lot: `9Ul9zVn6JnG_B_508-fZfxtp7mB1uY41ciQmd97BOEg`
- That live run exposed one route-boundary defect: observer relay selection read
  only `location.search`, while Bazar's hash router stores `?node=` after the
  hash. The state reader already handled both forms. The relay helper now does
  too, with a regression test. The same accepted reservations resumed without
  signing again and immediately rendered eight real relayed node lanes in each
  listing tab at depth 2.
- Reload recovery also exposed React StrictMode stopping the newly-created
  observer network during its intentional development effect replay. Resource
  cleanup is now deferred one task and cancelled by a matching remount, while a
  genuine route/document unmount still abandons local watchers normally.
- UX review round three judged the actual multi-order quote release-ready. Its
  one recommendation is applied: the disclosure now says exactly four wallet
  approvals for two matched listings instead of making the user infer the count.
- Current parallel reservation evidence:
  `.run-data/screenshots/fungible/12-parallel-registrations-listing-1.png` and
  `.run-data/screenshots/fungible/13-parallel-registrations-listing-2.png`.
- Both reservations were mined in the same block, 1,972,553, and every observer
  tab reached 5/5. The payment gate remained closed until the scheduler-safe
  state reached that exact block at network tip 1,972,563.
- The shared gate then changed both tabs from reserving to paying in one render
  and released both pre-signed native-AR payments together:
  - 3-WEAVE lot: `JR8wieQMDY0b4bt-jt4D8xpXt5QzX8KFxKmOiX4ohyk`
  - 5-WEAVE lot: `bYUzZBLiyMko_PlrVzINvn2QIh3_Ax-UTvaf22Qfprw`
  Both were accepted before the next block. Browser evidence:
  `.run-data/screenshots/fungible/14-parallel-payments-listing-1.png` and
  `.run-data/screenshots/fungible/15-parallel-payments-listing-2.png`.
- Both payments were then mined together in block 1,972,564. Each independently
  reached 5/5, after which Bazar continued waiting for live token state instead
  of treating base-layer confirmation as settlement.
- At network tip 1,972,574, scheduled state applied both payments in one process
  transition. The exact final state is:
  - Party A: `999992000000000000` atomic units (999,992 WEAVE)
  - Party B: `8000000000000` atomic units (8 WEAVE)
  - orders: empty
  - swap height: 1,972,564
- The final receipt says `8 WEAVE received from 2 listings · 0.000009 AR paid
  to sellers` and links both payment IDs. Party B's final AR balance is
  `1.382697967578 AR`, exactly the pre-sign quote's post-purchase balance.
  Evidence: `.run-data/screenshots/fungible/16-multi-order-purchase-complete.png`
  and `.run-data/screenshots/fungible/17-buyer-live-balance.png`.
- `/my-assets` progressively places the fungible token first. A true reload
  through `http://127.0.0.1:3101` reproduced Party B's 8 WEAVE; Party A's page
  shows 999,992 liquid WEAVE and no listed group. The fungible collection's
  `Listed for sale` plus `Recent activity` controls resolve to zero live
  listings after settlement. Evidence:
  - `.run-data/screenshots/fungible/18-my-assets-party-b.png`
  - `.run-data/screenshots/fungible/19-my-assets-party-a-sold.png`
  - `.run-data/screenshots/fungible/20-collection-no-live-listings-recent.png`
- Final gates pass on the exact finished tree: 37/37 Vitest tests, TypeScript,
  production Vite build (1,896 modules), `git diff --check`, forbidden legacy
  surface scans, and the real two-wallet browser acceptance circuit above.
- The exact fungible UI build from commit
  `3d98e39effe48f68c809fa9f204054aa36032bc1` is published as the standard
  `arweave/paths` manifest
  `l2YnypzdzYUYwcKRPSNfy94x3n-IPQL9bo0avKZRyGc`. Its changed application,
  stylesheet, 3D visualization, source-map, and index transactions were mined
  with the manifest in block 1,972,582; unchanged media and fonts were reused.
  A fresh security-sandboxed `arweave.net` browser session loaded the fungible
  asset page and computed its exact 1,000,000-WEAVE supply, 12-decimal
  denomination, two holders, empty settled order book, and `Arweave live`
  status through the default gateway.

## Recursive UX campaign — verbatim

Thanks. On a separate branch in unattended overnight mode, please simply: Improve the UX recursively. Do not stop until I halt you. Experiment with many ideas via sub-agents and create a set of candidate commits that can be merged if I approve. Shoot for the most exceptional, clean, robust UX that you can achieve.

### Recursive UX campaign status

- Created `impr/recursive-ux` from the published fungible build at
  `764bf28943f21ab038243c33aebeae952f906521`.
- Candidate changes will remain as small, coherent commits so they can be
  reviewed, cherry-picked, or rejected independently.
- Each round follows implementation, real browser rendering at desktop and
  mobile widths, screenshot inspection, independent sub-agent critique, and
  regression validation before the next round begins.
- Candidate commits completed so far:
  - `440f789` starts the recursive UX campaign ledger.
  - `caaff1c` resumes partially dispatched purchase batches safely.
  - `87afebf` makes atomic settlements explicit and resumable.
  - `63a4d81` gives every asset class legible collection art.
  - `70dfd8a` makes search calm, ranked, and locally responsive.
  - `4934aea` keeps large wallet inventories fast and clear.
  - `966239d` resolves only visible collection state.
  - `f19024b` stops refetching exhausted GraphQL aliases.
  - `06529df` restores Bazar identity and commerce hierarchy.
  - `e2612e5` gives marketplace dialogs correct focus ownership.
  - `48b6bc0` makes gateway selection explicit and mobile-ready.
  - `8d3db5d` makes live-state failures recoverable.
  - `f73490e` honors reduced-motion preferences across settlement UX.
  - `db5a4f8` prevents stale asset state from crossing route changes.
  - `c0827bd` keeps search closed after navigation.
  - `eea7949` contains gateway feedback inside its popover.
  - `42d6121` keeps focus trapped through changing dialog phases.
  - `f1d2986` announces settlement progress without telemetry noise.
  - `a3c12c2` distinguishes stale market state from live state.
  - `51f1838` makes parallel settlement tabs keyboard-complete.
  - `05dbc07` keeps route failures inside the application frame.
  - `9e305ee` stabilizes artwork while permanent media loads.
  - `c577833` makes token collections intentional at every width.
  - `d8d1396` connects trade validation to the exact invalid field.
  - `18f605e` keeps stale market actions closed during refresh.
  - `43a1b4e` exposes confirmation depth as a semantic progressbar.
  - `95c6c1f` keeps token cards aligned inside mixed inventory grids.
  - `14fed31` removes inert controls from a single-token collection.
  - `9870c3f` shows honest indeterminate wallet discovery progress.
  - `b4de115` makes failed fungible purchase quotes recoverable.
  - `9a3c201` keeps home market summaries truthful and progressive.
  - `74d8b95` bounds every permanent-index request with a fresh deadline.
  - `c33255b` gives SPA navigation a consistent focus contract.
  - `19de92d` reveals independently loaded collection indexes immediately.
  - `c0e93c2` keeps request deadlines active while response bodies stream.
  - `5c1f27f` keeps unavailable listings out of verified-empty market states.
  - `d2c0ca1` distinguishes repeated fungible order actions unambiguously.
  - `af79a94` resets collection controls when navigating between collections.
  - `55cd852` reuses resolved listings when changing local collection sorts.
  - `2d993fe` closes collection filter menus correctly on keyboard exit.
  - `c8425d0` gives atomic and fungible order books complete table semantics.
  - `673d363` names collection search and result updates for assistive tech.
  - `400cc0b` preserves cumulative price resolution across pagination.
  - `7f0d380` checkpoints the seventh recursive review round.
  - `7f04446` removes modal-search background content from keyboard and assistive navigation.
  - `aa92f47` keeps verified collections usable while their indexes refresh.
  - `42aae1b` discloses when an artwork collection uses its compiled manifest fallback.
  - `6932e29` lets pending atomic and fungible actions remain deliberately dismissed.
  - `f04bf0b` waits for every parallel settlement before reporting batch recovery.
  - `5041e54` reveals verified listings as each unique activity page resolves.
  - `d7d1580` coalesces progressive wallet results without hiding verified cards.
  - `c21adb9` retries unavailable wallet assets without restarting successful work.
  - `928c1e7` keeps discovery and live-state resolution progress distinct and honest.
  - `758ef51` balances empty-search and home discovery across asset collections.
  - `95485a3` binds pending operation recovery to the wallet that signed it.
  - `bbc00f0` resumes failed purchases in place without reloading the application.
  - `ef4e710` moves cursor discovery to a GraphQL endpoint that supports its own cursors.
  - `43d4bb6` rejects malformed GraphQL connections instead of treating them as empty.
  - `6add992` paginates carrier-name discovery through cursor-compatible GraphQL.
  - `bad0fd0` preserves loaded carrier names and exposes a recoverable page failure.
  - `bd37942` lets assistive technology use collection results while they stream.
  - `72009e6` keeps route titles correct after slow asynchronous index loads.
  - `317ca0f` makes the 27-option alphabet filter a single keyboard tab stop.
  - `edd79a2` identifies the current marketplace destination in primary navigation.
  - `37e46f4` presents one coherent recovery state when every wallet result is unavailable.
  - `b296091` constrains search and transaction overlays to the live safe viewport.
  - `ba0587f` exposes one carrier-pagination retry instead of two identical actions.
  - `1ded2eb` keeps every exact purchase total visible on phone-width dialogs.
  - `71934be` contains long compute-gateway identities without widening the page.
  - `92d169f` hides decorative collection-activity glyphs from assistive technology.
  - `2c112c5` announces progressive wallet resolution at a human cadence.
  - `3a7df4a` keeps wide fungible dialogs inside their safe overlay gutters.
  - `3da2def` removes the nested touch scroller from phone-width listing selection.
  - `5525b84` intersects carrier discovery with the immutable current names namespace.
  - `71aacee` makes transaction recovery ownership financially exclusive before dispatch.
  - `1a33cee` gives every narrow-header action a 44-pixel touch target.
  - `e435a37` distinguishes pending activity from a nonexistent block zero.
  - `dc694a0` checkpoints the twelfth recursive review round.
  - `3b9bae7` enforces exact canonical carrier membership across discovery, state, routes, and activity.
  - `1ab022a` stops interrupted wallet discovery from looking active.
  - `ce75773` preserves complete wallet progress while retrying unavailable candidates.
  - `4dbd434` keeps progressive collection snapshots monotonic during pagination.
  - `dc1835b` labels canonical name discovery honestly while raw pages remain.
  - `81da146` keeps verified collection activity visible while it refreshes.
  - `687a8d1` keeps GraphQL absence distinct from verified live market state.
  - `0a0b766` keeps resolved home summaries stable as indexes stream.
  - `787855f` gives unavailable home summaries a local retry.
  - `231934c` makes large name and wallet groups progressively compact.
  - `36da0c1` adds signed price, order, and transfer context to permanent activity.
  - `a326c11` moves keyboard focus to the safe resume action after dismissing tracking.
  - `90543fa` announces retained-content gateway failures without disruptive alerts.
  - `0f0a39b` checkpoints the thirteenth recursive review round.
  - `736aa38` renders exact quantity and price context in fungible market history.
  - `6e0542d` prevents failed market-history reads from masquerading as empty history.
  - `9abd699` keeps document titles synchronized with asynchronously resolved routes.
  - `1b67c69` distinguishes indexed market activity from confirmed permanence.
  - `4769281` reveals long activity feeds in exact, bounded local batches.
  - `c314f5d` synchronizes asset section navigation with directly opened disclosures.
  - `5bf0f7e` keeps whole-lot purchase totals visible in narrow fungible order books.
  - `59ed1e8` quotes atomic seller price, network fees, maximum spend, and wallet balance before approval.
  - `176aa17` labels atomic order history as complete market history rather than price history.
  - `2ef93fa` identifies and links the exact seller inside atomic purchase confirmation.
  - `c4d3193` keeps keyboard focus inside checkout while asynchronous quotes load.
  - `259cd33` keeps failed confirmation bars aligned with their real confirmation depth.
  - `0bafa46` visibly labels the active reservation, payment, or asset-action phase.
  - `7fef946` gives every phone-width modal dismissal control a 44-pixel touch target.
  - `f17c826` identifies an unreachable compute gateway and explains both recovery paths.
  - `fb899c4` gives fungible settlements the same actionable financial recovery language as atomic trades.
  - `39274af` makes completed atomic and multi-listing purchases independently traceable from their receipts.
  - `f6765fd` locks background scrolling behind search and operation dialogs without losing route position.
  - `4ae7950` discloses every matched fungible listing before approval.
  - `4d94cda` surfaces wallet connection and invalid-wallet-file failures in place.
  - `7d1692e` discards only terminally rejected fungible action signatures while preserving ambiguous recovery.
  - `6535c95` exposes the exact failed listing, stage, seller, order, and transactions in parallel settlement recovery.
  - `2773376` identifies the seller and order in every multi-listing purchase receipt.
  - `cb07a10` lets valid atomic and fungible trade forms submit exactly once with Enter.
  - `818a5c5` makes observer lanes and event pips inspectable by keyboard and touch without replacing the 3D view.
  - `f3973eb` keeps proof cards compact and readable on phone-width transaction visualizations.
  - `b0302c0` checkpoints the seventeenth recursive review round.
  - `d4f4911` searches the complete canonical names namespace without sequential carrier-page scanning.
  - `894cfff` gives marketplace search both explicit and Enter-key submission.
  - `c773914` exposes the compute gateway as a complete keyboard disclosure.
  - `7a408ff` gives collection activity a real heading and named feed structure.
  - `139a7c7` announces honest, deferred marketplace search result summaries.
  - `a1fc583` preserves complete asset identities on narrow two-column cards.
  - `e4bcf4e` clears inactive search text after direct result navigation.
  - `ef7f268` links every collection activity counterparty to its Arweave identity.
  - `34a9dfc` renders canonical name results as names rather than fungible tokens.
  - `330ae6b` keeps every exact atomic purchase total readable at 320 pixels.
  - `e4963d7` gives the mobile gateway input and submit action 44-pixel targets.
  - `58b8c29` keeps bounded search counts and routed-result provenance honest.
  - `2f8a48f` gives the newly added mobile search submit action a 44-pixel target.
  - `76065b8` prevents long dialog headings from compressing modal close targets.
  - `d7dfc1f` surfaces wallet connection failures inside disconnected commerce views.
  - `78610b6` enlarges standalone back-navigation targets at desktop and phone widths.
  - `07d45da` checkpoints the twenty-second recursive review round.
  - `eedca75` completes mobile search touch targets without disturbing its horizontal scopes.
  - `8b7bb5a` completes mobile collection, filter, recovery, and pagination touch targets.
  - `004d448` prevents activity loading from announcing a contradictory empty result.
  - `5a1e5b4` makes collection-reference retry progress visible and non-repeatable.
  - `53d843a` checkpoints the twenty-third recursive review round.
  - `aab3a3e` enlarges the primary mobile wallet-inventory actions.
  - `578211c` removes disconnected fungible order actions that could only no-op.
  - `59832ac` gives mobile fungible row actions complete touch targets.
  - `1dbe213` names unavailable indexes by their visible immutable collection names.
  - `f999562` preserves seller, order, stage, reservation, and payment traceability in atomic receipts.
  - `fe417f9` completes the mobile operation-dialog touch target contract.
  - `69b048d` keeps reserved one-of-one orders visibly non-actionable.
  - `7f05251` submits and persists the exact normalized atomic transfer recipient.
  - `c5234a0` rejects atomic and fungible self-transfers before wallet approval.
  - `a4ba1d1` fails explicit wallet connections when no valid active address can be read.
  - `3ce6855` labels indexed market activity as submissions rather than outcomes.
  - `b93d856` keeps fungible settlement language pre-approval truthful.
  - `f22e90d` directs observation failures to the in-place resume action.
  - `c80cbe6` labels reserved atomic assets consistently at every level.
  - `130b059` keeps fungible completion actions honest about their destination.
  - `37d9564` restores the committed route query when search is cancelled.
  - `ed84fc7` restores wallet-trigger focus after dismissing a connection error.
  - `f33f8fe` keeps progressive wallet activity monotonic across aliased discovery.
  - `b1f0146` refreshes live asset state and indexed activity from one boundary.
  - `7bf4eee` discloses the bounded provenance of asset activity feeds.
  - `a8003e3` contains long mobile UDL and license values.
  - `3b901d8` retains compact asset-history timestamps on mobile.
  - `0edc26a` prevents stale asynchronous wallet reads from restoring an old signer.
  - `a835170` completes mobile market navigation and history touch targets.
  - `c34c8e2` keeps activity refresh focus stable through loading and failure.
  - `4adca6e` serializes collection activity announcements into one network-status stream.
  - `9f0b84b` hands focus to a visible completion status after final progressive reveals.
  - `d093af5` clears stale activity reveal summaries when history refreshes.
  - `942e000` exposes manual fungible lot selection to assistive technology.
  - `60f7153` keeps quote retry focus inside atomic and fungible checkout.
  - `d9772f0` synchronizes signer-scoped pending operations across browser tabs.
  - `0a66557` isolates operation dialogs from background assistive navigation.
  - `b4047e5` stacks exact fungible orders legibly on phone-width screens.
  - `9631794` contains exact multi-listing purchase quotes on narrow screens.
  - `80b3882` replaces broken wallet transaction links with copyable identities.
  - `5ca8334` opens transaction metadata rather than raw permanent payloads.
  - `4dca1f7` qualifies empty wallet discovery without inferring live ownership.
  - `a8d5895` makes live-state freshness, gateway, and cache intent explicit.
  - `92e1744` revalidates exact market state before requesting wallet approval.
  - `84ce98e` claims signer-scoped wallet operations before any approval across tabs.
  - `c7fa737` keeps explicit live-state freshness on both JSON codec attempts.
  - `516fb41` aborts hung dispatch work when network observation expires.
  - `638591c` refreshes indexed asset history when a visible route returns.
  - `301b3cb` makes wallet-identity copy failures visible and actionable.
  - `acaf591` holds exclusive wallet-operation claims through final live-state application.
  - `39b27f6` completes mobile wallet-identity copy targets.
  - `629b319` contains arbitrary collection names in narrow asset headers.
  - `a9fbc7f` dates retained state checks explicitly.
  - `8314ecc` preserves collection identity when permanent artwork is unavailable.
  - `a7049e4` reclaims crashed cross-tab wallet-operation locks safely.
  - `60c5ec5` sizes failed collection-artwork marks correctly.
  - `ae59741` keeps state check dates unambiguous across midnight.
  - `b851196` rejects GraphQL pages that promise continuation without a cursor.
  - `8da0142` retains a readable published collection while a replacement index is pending or malformed.
  - `483cb85` first removes the 100-token truncation; `f9deb68` refines it into fast cursor-backed, on-demand token pages that retain completed work.
  - `cc15592` first makes collection order canonical; `0a943c2` refines reconciliation so populated retries do not churn existing cards.
  - `5a9c651` stacks exact settlement receipts at phone widths.
  - `4928d6e` gives mobile settlement links complete touch targets.
  - `0a2f695` preserves centered presentation for direct result links.
  - `7db36d0` scopes fallback provenance to collection indexes on both atomic and fungible assets while affirming current live state.
  - `1262e52` detects cursor cycles and bounds every paginated index traversal.
  - `691634e` makes paged token search match name, ticker, and process ID while keeping the next-page action available.
  - `349236c` resolves unloaded fungible assets from their exact live process contract and preserves loaded token pages through retries.
  - `879a83b` scopes floor, listing, and activity claims honestly while a token index is only partially loaded.
  - `0f4c1b2` accepts Arweave GraphQL count strings so successful live token discovery no longer falls back spuriously.
  - `a4f8b6a` lets exact process-ID search verify unloaded tokens from live state while qualifying partial token indexes.
  - `c17a881` verifies unindexed candidates in batches before compute, applies the exact token contract uniformly, and restarts changed index windows safely.
  - `d16ad5b` turns compute throttling into explicit wait-or-change-gateway recovery.
  - `0bb9322` stops a rate-limited live-state read before the fallback codec can amplify it.
  - `c06b357` preserves marketplace search text when continuing into a paged token collection and matches submitted tickers and process IDs consistently.
  - `5988c7b` resolves known wallet assets while unrelated candidate support checks run, screens each discovered ID once, and respects Arweave GraphQL’s nine-ID limit.
  - `a713c99` retains successful support-verification batches when another batch is unavailable and aborts active workers without draining queued requests.
  - `80520bd` distinguishes compute throttling from transaction-index throttling across aggregate marketplace screens while preserving verified results.
  - `a6dbdda` uses 100-candidate support batches on Turbo while retaining Arweave GraphQL's proven nine-ID limit.
  - `a757be3` leads collapsed fungible pages with verified commerce before compact artwork.
  - `ab7e5de` reconciles wallet retry metadata with the newest indexed activity and current failure category.
  - `76b3b11` preserves exact activity-recovery guidance beside retained events.
  - `5aa21ed` distinguishes transaction-index screening failures from live-state compute failures in wallet status and announcements.
  - `36be476` retries only unavailable Home summaries and collection listing candidates while preserving verified results.
  - `dcef847` gives atomic assets the same commerce-first collapsed hierarchy as fungible tokens.
  - `c3d94fc` keeps global Search behind an active marketplace transaction dialog.
  - `6416bf7` keeps permanent-data proof previews inside the settlement focus trap.
  - `ecc3d48` binds listing retries to the exact manifest and loaded-token scope, with full retries revalidating settled candidates.
  - `31743b5` makes the aggregate Home market retry singular, disabled, and explicitly in progress.
  - `e52778e` bounds automatic permanent-data image previews to declared payloads of at most 2 MiB.
  - `5fe9054` bounds long mobile multi-listing selectors without hiding any available lot.
  - `f7f5d71` memoizes exact collection activity fingerprints across local renders.
  - `d153992` lets the focused transaction map clear its own inspection with Escape without closing checkout.
  - `4379d52` announces large collection resolutions at human milestones while retaining exact visual progress.
  - `db54c87` carries still-pending Home summaries into an in-place retry instead of stranding them at Checking.
  - `c637e31` preserves unchanged collection object identities as independently loaded indexes arrive.
  - `7d22e38` turns a 512-listing manual picker into one conventional roving keyboard stop.
  - `2acf5c7` keeps paginated collection announcements monotonic and batches failure churn.
  - `b7a53a5` degrades an unavailable WebGL transaction map into live textual observer status.
  - `4000ca8` coordinates Home summary reads per asset and collection instead of restarting whole groups.
  - `fc65f59` extends paged token listing scans with only the newly loaded asset window.
  - `82441ff` removes covered proof links from the non-WebGL transaction fallback.
  - `45b1213` classifies failed parallel settlements as needing attention instead of reserving.
  - `1288f77` commits an incremental token listing window only after its scan succeeds.
  - `024f69b` restores focus to the live trade action before any post-operation state refresh.
  - `e946465` restarts Home summary reads after React StrictMode's intentional effect replay.
  - `ccc61b1` preserves a meaningful focus destination when refreshed trade actions change or disappear.
  - `8c665dd` keeps changing textual observer rows outside the non-WebGL fallback live region.
  - `edbdcd5` keeps paused atomic and fungible recovery focused on the newly visible Resume action.
  - `12e677b` exits stale revalidated trade forms to freshly computed market state instead of looping.
  - `1f75c3a` contains uninterrupted on-chain asset names without displacing dialog dismissal.
  - `e527cd4` removes unavailable current reads from the verified live-listing result set.
  - `7302489` places stale atomic market recovery in the reachable error phase.
  - `68b97da` sorts verified live listings by their latest indexed market action.
  - `a465e96` keeps multi-settlement recovery controls outside assertive alerts.
  - `a4c5c0f` keeps atomic transaction recovery outside assertive alerts too.
  - `51b6343` contains maximum-length on-chain token tickers in trade dialogs.
  - `0c3f042` resolves large live-listing activity sets in incremental bounded windows.
  - `6fe7f59` discards incomplete pre-dispatch wallet-approval batches atomically.
  - `b18202a` contains maximum-length token tickers inside their form labels and inputs.
  - `bf89a39` cleans pre-dispatch approval sets when their owning route or wallet aborts.
  - `515bf60` classifies concurrent activity-window failures deterministically.
  - `c9da704` bounds Home collection-floor discovery with the same incremental
    market-activity windows used by collection views.
  - `6ff612f` places active settlement recovery explanations in the sequential
    keyboard path before their seller-specific controls.
  - `9ba176b` introduced a preliminary aggregate fungible-transfer baseline;
    it is superseded by `1733d49` and must not be cherry-picked alone.
  - `c4bfa3c` isolates completion announcements from their interactive receipts.
  - `6caa397` retains completed Home activity windows when a sibling window fails.
  - `2b119c5` makes fungible transfer destinations reviewable and mutation-safe on mobile.
  - `1733d49` verifies fungible transfers from their exact scheduler assignment
    and exact-slot debit/credit notices rather than confusable aggregate deltas.
  - `de99fb2` removes terminally rejected transfer recovery without presenting
    a false paused action and keeps the exact destination visible.
  - `b2eb59d` preserves keyboard focus when leaving collection filter menus.
  - `9612707` refreshes completed Home activity snapshots when membership
    changes or a compute failure invalidates their live result.
  - `1fce1d8` keeps shared Home retry ownership through replacement effects.
  - `bf1db89` prevents native transaction quantity from shadowing a fungible
    transfer's exact token quantity.
  - `934c0ea` preserves transfer recovery when scheduler evidence is incomplete
    while keeping a proven exact token rejection terminal.
  - `571c76b` localizes exact transfer assignments by mined block height instead
    of walking every process slot since approval.
  - `48c1ab1` explains retained immutable collection indexes without implying
    that live ownership or market state came from the fallback.
  - `cc21827` preserves exact recipient, quantity, asset, and transaction
    details in atomic and fungible transfer receipts.
  - `b28b6c3` follows an exact transfer when its mined height changes before
    scheduler finality.
  - `155e37c` retains the exact transfer baseline through same-dialog proof
    recovery without requiring a reload or another signature.
  - `56f49de` excludes inactive roving controls from modal tab boundaries.
  - `79c34b9` normalizes pasted transfer recipients before every validation,
    review, persistence, and signing boundary.
  - `b7e6861` prevents iOS auto-zoom by keeping narrow dialog form controls at
    a measured 16-pixel font size.
  - `9ff6756` makes exact selected seller addresses visually reviewable before
    fungible purchase approval.
  - `3c27129` discovers large collection listing sets in independently retained
    100-recipient windows through two bounded workers.
  - `3e8e3c0` keeps empty completion live regions mounted before their concise
    outcomes arrive while leaving visual receipts outside announcements.
  - `28a110f` labels listing discovery work and live-listing totals precisely.
  - `501b205` keeps exact recipient identities visible in both transfer
    receipts.
  - `c93a3ad` locks exact irreversible-party identity rendering in a component
    regression.
  - `300937a` directs incomplete transfer-proof recovery to the existing
    in-dialog resume path and header gateway control.
  - `6211c5f` keeps exact seller identities visible in atomic and fungible
    purchase receipts.
  - `bc00f4e` bounds large matched-seller disclosures, removes hundreds of
    unnecessary tab stops, and never erases an identity after copy failure.
  - `841dec5` rejects a wallet-returned transaction whose target, native
    quantity, action, recipient, token quantity, or tag set differs from the
    exact transaction the application requested.
  - `0caf61e` gives atomic transfers the same normalized, complete destination
    review and mobile-keyboard safeguards as fungible transfers.
  - `f24839d` batches visible collection-card price discovery into retained
    100-recipient windows through two bounded workers.
  - `85d5b93` identifies listing discovery counters as per-pass work so retry
    and collection growth never imply cumulative progress that did not occur.
  - `bffa702` verifies that every wallet-signed transaction preserves its exact
    semantic tag intent through Arweave encoding.
  - `ac7c2e6` completes narrow-screen navigation touch targets without changing
    the familiar Bazar header hierarchy.
  - `bde25f0` batches collection activity discovery into retained bounded
    recipient windows.
  - `28db497` preserves the exact identities of both pre-signed purchase legs
    across recovery.
  - `6affdd0` revalidates resumed reservations from current live market state.
  - `c7810ef` exposes complete irreversible counterparties before approval and
    in permanent receipts.
  - `6e8af1b` turns very large matched-seller reviews into one bounded,
    keyboard-reachable disclosure.
  - `5b73290` preserves a settlement tab panel while its signed work is still
    being prepared.
  - `439db80` bounds completed multi-order receipt review to one active listing.
  - `327cce2` binds every settlement tab to one stable, focusable panel.
  - `7cfb267` announces parallel settlement through calm 25/50/75/100 percent
    milestones and the first failure rather than sibling telemetry churn.
  - `d4c4f3c` integrates typed not-sent, definitive-rejection, and ambiguous
    dispatch outcomes so recovery never loops a terminally rejected signature
    or replaces an uncertain one.
  - `d26af64` retains every successful Home floor contribution and retries only
    unavailable or newly changed candidate state.
  - `84a2de7` groups wallet results once per published result set instead of
    rescanning every live order after each progress update.
  - `caec328` gives aliased wallet-candidate GraphQL an atomic, in-memory
    pagination checkpoint that resumes only unfinished aliases and pages.
  - `d51f3c1` keeps the corresponding component-local live-resolution session,
    verified cards, and exact progress through an interrupted discovery retry.
  - `4375482` preserves recovery focus and revealed inventory through retry,
    progressive arrivals, and responsive breakpoint changes.
  - `81d01ee` preserves keyboard focus on the live wallet-resolution status
    during an explicit refresh.
  - `6b5eb01` derives aggregate transaction completion only from conservative
    observer quorum, never from raw per-node depths.
  - `7b76ca1` gates wallet cards and progress by their exact signer, gateway,
    collection, and refresh scope before effects can reset stale state.
  - `a983727` offers both resumable checkpoint retry and a clean wallet-
    discovery restart when a cursor cannot advance.
  - `fbb1511` preserves revealed collection cards, retry focus, and final-
    reveal focus across responsive and progressive result changes.
  - `87bf361` commits successful unavailable-asset retries into the resumable
    wallet session and rejects late retries from superseded scopes.
  - `57a5033` invalidates and recomputes a wallet candidate when a later alias
    page reveals strictly newer indexed activity.
  - `691afba` keeps immutable-index retry feedback stable while its focused
    control is busy.
  - `2c04a4f` preserves collection-activity reveal focus through final batches.
  - `a21b172` keeps aggregate transaction progress strictly quorum-bound.
  - `310b55b` resumes a terminally rejected seller payment from the repaired
    registration-only snapshot instead of replaying the rejected leg.
  - `cfe4cae` carries canonical watcher consensus through single actions and
    clears stale observer lanes before retries.
  - `eea9f81` gives the auto-focused marketplace search field a visible focus
    boundary.
  - `be657f6` restores collection filter focus and the alphabet roving tab stop
    after an empty-state clear.
  - `f0b94b1` retains modal-search focus and announces recent-history removal
    after destructive clears.
  - `4be2b87` bypasses live-state caches for explicit wallet refreshes.
  - `b06a2fc` bounds large wallet-discovery announcements while keeping exact
    visual progress.
  - `a512052` preserves collection status focus when unavailable listings are
    retried.
  - `67d5cf6` synchronizes atomic and fungible section navigation with the
    disclosures that are actually open.
  - `57db291` indexes immutable supported-asset membership once per collection
    snapshot instead of rescanning every asset for every wallet candidate.
  - `ae4f4ed` retires signed transaction material only after corresponding
    live-state success has been verified.
  - `d2162af` renders one stable search-scope control set at every responsive
    width instead of retaining hidden duplicates.
  - `2bf741b` closes resumable descending wallet scans against stable head
    watermarks and detects distinct same-block activity.
  - `3cd17bb` progressively preserves wallet cards while zero-age live state
    performs a final ownership reconciliation before completion.
  - `89073ba` preserves signed transactions whenever a newer recovery record
    owns the signer-scoped storage key.
  - `019f754` keeps keyboard focus on atomic and fungible asset refresh actions
    throughout live-state replacement.
  - `fa3cc0c` reveals the desktop test-wallet file control with the same visible
    focus contract as ordinary header actions.
  - `962c971` separates accessible positive text from decorative green accents,
    raising white-background contrast from 2.90:1 to 5.35:1.
  - `aa66bec` lets the transaction map consume Escape only while an inspection
    is visible; otherwise checkout owns its dismissal key again.
  - `0ac7cfc` keeps exact collection-activity scan counters visual while polite
    announcements advance only at bounded ten-batch milestones.
  - `fe1ca69` verifies new fungible purchase settlement from the zero-age
    pre-approval balance while retaining the persisted baseline on resume.
  - `9c201c1` retires atomic purchase recovery that current state proves is
    completed or no longer resumable instead of reopening it forever.
  - `3901609` applies the same terminal-state contract to parallel fungible
    order recovery, including partial settled quantities.
  - `f1c435e` removes a newly prepared signature when route or wallet aborts
    before its recovery record can take ownership.
  - `b5ad799` overlaps resumable wallet discovery with bounded live-state
    resolution so verified cards appear while later GraphQL pages continue.
  - `ca3063c` dismisses marketplace search on external route changes without
    stealing the destination page's focus.
  - `623e73f` preserves exact signed evidence when a purchase becomes blocked
    rather than deleting a possibly dispatched seller payment.
  - `cec5f88` aborts already-cancelled ambiguous dispatch waits immediately in
    both Bazar and its vendored weave-wrangler.
  - `e33bd29` exposes complete connected-wallet and compute-gateway identities
    without expanding their compact header labels.
  - `ae95c75` raises functional small-text and placeholder contrast to WCAG AA.
  - `96bcff2` removes the narrow-header breakpoint cliff and restores true
    44-pixel search targets.
  - `260998c` retains price, quantity, seller, status, and actions in narrow
    atomic and fungible order books.
  - `ad3c0fb` keeps interactive recovery controls outside changing live
    regions so only concise status text is announced.
  - `82c7cde` exposes exact wallet-inventory counts and compact zero-result
    groups to visual and heading navigation.
  - `4e3fd9a` exposes complete fungible seller identities in irreversible
    actions and selection controls while keeping 512-receipt rendering bounded.
  - `1f0eb26` places immutable-index provenance after current asset identity
    and live commerce while preserving its complete retryable disclosure.
  - `49940ef` debounces matched-order quotes, cancels abandoned price and
    balance requests, and coalesces identical targets across a final batch.
  - `61d3843` vendors exact-ID, lazy reorg replay from weave-wrangler candidate
    `afaed9c` without signing or eagerly reposting normally confirmed work.
  - `47d4440` leaves visual marketplace search immediate while settling its
    polite result announcement only after rapid typing pauses.
  - `048ee82` bounds wallet ownership revalidation speech to deciles and makes
    inventory reveal announcements user-action-only.
  - `c38c2ef` stops an expired unpaid reservation on its first fresh-state
    check before any seller payment can be released.
  - `6d10681` keeps the primary irreversible action visible inside short-height
    operation dialogs without changing ordinary portrait or desktop layouts.
  - `e40e70d` gives immutable-index recovery controls a complete 44-pixel
    target across the full mobile asset-page breakpoint.
  - `c503c32` removes duplicate whole-row narration from semantic atomic and
    fungible order books while retaining every header, cell, seller, and action.
  - `8b685c9` proves cancellation and transfer completion from each exact
    committed scheduler assignment and immutable slot transition instead of
    confusable aggregate order absence or recipient balances.
  - `b019030` keeps the visible focus ring of a sticky short-dialog action
    inside its owning scroll boundary.
  - `7cb38ad` enables React Router's stable v7 transition and relative-splat
    behavior, removing repeated compatibility warnings from clean startup.
  - `f280081` checkpoints the sixty-second recursive review round.
  - `ea3fbc5` bounds large multi-seller purchase quotes to eight concurrent
    requests and closes the final wallet-balance abort gap.
  - `93c07d8` proves every purchase from its exact committed scheduler payment
    slot instead of aggregate balance or order-absence heuristics.
  - `e015bc5` rediscovers schedule boundaries after a same-height reorg.
  - `9940be5` names every trade dialog by its exact task and focuses the task
    field rather than its dismissal control.
  - `6aa4a44` preserves meaningful keyboard focus through collection and
    live-state retries.
  - `58dbfed` persists parallel settlement recovery only when durable signed
    transaction facts change.
  - `dce801a` keeps every focused short-height trade field completely visible
    above a separate, persistent action footer.
  - `ff1b5cf` preserves complete two-leg settlement recovery through partial
    resume projections without redundant batch rewrites.
  - `7e24fac` bounds progressive wallet resolution to one active and one queued
    discovery page while retaining discovery/compute overlap.
  - `0cf7850` coalesces each parallel observer wave into one visual settlement
    update while flushing terminal outcomes synchronously.
  - `a54579b` reveals very large fungible order books in exact 50-row batches.
  - `b47b796` rejects automatic matching after the 513th open order without
    sorting or consuming the rest of an unbounded order source.
  - `34e36be` presents interrupted wallet discovery as one calm recovery state
    without a stopped progress bar or duplicate retry action.
  - `d19b7dd` politely announces every progressive order-book reveal while
    retaining focus on the reveal control.
  - `80583ad` restores visible My Assets and Gateway labels from 360-pixel
    phone widths upward while keeping smaller screens icon-only.
  - `d256007` removes repeated collection names and shortened process IDs from
    collection-context asset cards without removing that provenance elsewhere.
  - `4c822df` coalesces durable parallel-settlement checkpoint waves while
    forcing storage ownership before any seller payment is released.
  - `cd9d089` checkpoints the sixty-fifth recursive review round.
  - `e0c7dd0` keeps asset media ahead of non-blocking immutable-index recovery
    on collapsed asset pages.
  - `46a9f1d` indexes exact collection candidate membership once instead of
    rescanning large asset arrays at three listing boundaries.
  - `1efde6d` announces entered atomic and fungible trade validation failures
    while leaving initial form guidance non-assertive.
  - `e58e0a9` indexes aggregate carrier-name membership once for Home floors
    and collection activity instead of repeatedly scanning the namespace.
  - `eb9a34c` batches each progressive live-listing page into one retained
    result, price, and activity publication rather than one render per asset.
  - `411428e` preserves keyboard focus on collection pagination while its next
    immutable-index page loads and through the resulting continuation.
  - `4145b9b` retires only impossible stale operation recovery automatically;
    potentially applicable missing signed intents remain guarded without an
    auto-opened failing modal or a replacement transaction.
  - `182ab68` preserves keyboard focus on Home market retries throughout their
    busy state and through either a retained failure or successful removal.
  - `c57ff1b` indexes exact asset lookup once per immutable collection snapshot
    instead of linearly rescanning large collections for every candidate.
  - `37c4b6d` keeps the active multi-order receipt pager control focused when
    it reaches either endpoint.
  - `9f2e5e6` compacts mobile collection activity without shrinking touch
    targets or removing actor, time, transaction, or block semantics.
  - `be5575b` demotes safe mobile compiled-index provenance while retaining
    its complete explanation for assistive technology and desktop review.
  - `f961177` clears stale operation guards as soon as another tab or a fresh
    live-state check proves their tracked record has been removed.
  - `3c98e58` bounds manual fungible listing selection to progressive 50-row
    windows and replaces quadratic selected-order membership scans.
  - `cc37174` separates exact signed purchase observation from recovery that
    still requires new wallet approvals, which now waits for explicit consent.
  - `f1751c7` makes the horizontally paged mobile names alphabet visible,
    directional, and focus-preserving without changing its desktop layout.
- Browser evidence is organized by candidate under
  `.run-data/screenshots/recursive-ux/`, including gateway validation,
  live-state recovery, route states, progressive artwork, token collection and
  mixed inventory layouts, connected validation guidance, pending refresh
  truth, wallet discovery, unavailable-vs-empty market summaries, routed focus,
  progressive indexes, deadline failures, collection reset/local-sort behavior,
  keyboard-complete filters, semantic order books, named result states, and
  cumulative price pagination, isolated modal search, preserved collection
  refreshes, honest manifest provenance, progressive large-market listing
  resolution, filtered-listing empty states, safe dynamic overlays, canonical
  names pagination, bounded gateway labels, dense wallet inventories, compact
  name tiles, signed market-action details, honest indexed-vs-confirmed
  activity summaries, bounded activity-feed reveals, exact atomic purchase
  quotes and counterparties, explicit compute-gateway recovery, modal
  focus/scroll isolation, progressive 104-candidate wallet resolution, the
  fully resolved 100-asset collection, compact transaction proof cards,
  canonical namespace search and routed results, the structured collection
  activity feed, the revalidated 320-pixel atomic quote, and independently
  measured 44-by-44 atomic and fungible dialog close controls at 320 and 390
  pixels. Round 26 additionally records retained activity during refresh and
  the focus-preserving final reveal of a 100-asset collection under
  `.run-data/screenshots/recursive-ux/round26/`. Round 27 records a live listed
  Arweave-name purchase quote and a focus-preserving cost recheck under
  `.run-data/screenshots/recursive-ux/round27/atomic-quote-recheck.png`; the
  5 AR listing resolves through the selected HyperBEAM gateway and discloses
  seller price, network fees, maximum total, and wallet-after-purchase state
  without soliciting a signature.
- Round 28 records the live home, copyable wallet identity, explicit state
  freshness, mobile quote candidates, and the checkout after cross-tab claim
  hardening under `.run-data/screenshots/recursive-ux/round28/`. The current
  listed-name checkout still renders the exact seller, 5 AR ask, network fees,
  maximum total, and affordability state without soliciting a signature.
- Rounds 29–32 add real-browser evidence for canonical collection ordering,
  explicit retained-state timestamps, identity-preserving artwork fallback,
  and scoped atomic/fungible index provenance under
  `.run-data/screenshots/recursive-ux/round29/` through `round32/`.
  `round31/canonical-collection-order.png` shows the same Names → Tokens →
  Strata → Signals order produced by the immutable source index, and
  `round32/fungible-index-provenance.png` shows a fallback token index beside
  independently current HyperBEAM-computed balances.
- Round 34 records the corrected token fallback provenance and the recovered
  live token index under `.run-data/screenshots/recursive-ux/round34/`.
  A real Arweave GraphQL response demonstrated that `count` is a decimal
  string; after normalizing that wire value, a hot-reloaded browser removed
  the fallback notice and rendered the independently computed WEAVE market
  state from the live discovered index.
  Three independent Round 34 audits then drove strict loaded-token contract
  checks, batched pre-compute candidate verification, changed-window cursor
  recovery, truthful direct-token fallback copy, and honest activity
  navigation. A 150-candidate transfer-spam regression performs two
  100-ID-capable support checks through the default Turbo endpoint and zero
  HyperBEAM reads; an independent 19-candidate `arweave.net` control uses
  exactly `[9, 9, 1]` IDs through the same two bounded workers.
- Rounds 35–37 establish the final wallet-candidate and throttling controls.
  Real `arweave.net` GraphQL probes proved that transaction ID filters accept
  at most nine IDs; support verification now uses two bounded workers and
  preserves successful batches independently. The same real wallet then
  resolved 104/104 candidates to 99 owned assets without a repeated support
  pass. A task-local 429 control rendered the complete-wallet warning and
  `Retry later` action, while a naturally throttled live gateway rendered the
  matching home-market recovery. Evidence:
  - `.run-data/screenshots/recursive-ux/round35/routed-token-search.png`
  - `.run-data/screenshots/recursive-ux/round35/progressive-wallet-screening.png`
  - `.run-data/screenshots/recursive-ux/round37/my-assets-rate-limit.png`
  - `.run-data/screenshots/recursive-ux/round37/home-rate-limit.png`
- A protocol audit found no safe GraphQL-only discriminator between a valid
  transfer and a forged transfer-shaped transaction: only scheduled process
  execution knows the signer’s balance at that slot. The client therefore
  deliberately retains one bounded live read per distinct supported process
  rather than introducing a false-negative ownership filter. IDs are deduped,
  support checks are bounded, and live state remains the only ownership truth.
- Rounds 38–39 close the remaining collapsed-commerce and classified-recovery
  gaps. Fungible and atomic 630-by-924 controls both put identity, verified
  price/status, and the contextual primary action before compact artwork.
  Mixed-failure proxies proved that collection retries retain the verified
  0.5 AR Strata listing while issuing only the failed process read, and a
  stable Home retry issues only the failed asset/collection summaries. Search
  now remains closed when Cmd/Ctrl+K is pressed inside the atomic purchase
  dialog, leaving exactly one modal and focus inside it. Evidence:
  - `.run-data/screenshots/recursive-ux/round38/fungible-mobile-commerce-first.png`
  - `.run-data/screenshots/recursive-ux/round39/atomic-commerce-first.png`
  - `.run-data/screenshots/recursive-ux/round39/listing-targeted-retry.png`
  - `.run-data/screenshots/recursive-ux/round39/home-retry-busy.png`
- Round 40 closes four interaction and progressive-loading races found by
  independent audits. The transaction map now owns its documented Escape key;
  screen readers receive a start, bounded progress milestones, failure changes,
  and exact completion instead of one announcement per candidate; Home retry
  includes requests it intentionally aborts while they are still pending; and
  unrelated index arrivals preserve stable collection identities rather than
  restarting live listing and price work. Mobile multi-listing selection is
  independently bounded, and permanent-data image proof previews cannot
  auto-fetch an unknown or multi-gigabyte payload. Browser evidence:
  `.run-data/screenshots/recursive-ux/round40/home-stable.png`.
- Round 41 makes scale behavior interaction-safe as well as visually bounded.
  A manual fungible picker with 1, 100, or 512 orders has exactly one modal tab
  stop with arrow, Home, and End navigation; a changing GraphQL page total can
  no longer move announced progress backwards; and WebGL initialization failure
  leaves checkout, confirmation progress, live observer rows, telemetry, and
  recovery controls intact. Home now keeps unchanged per-card and per-collection
  requests alive as independent indexes arrive, while growing token windows
  preserve prior listings and query only their new IDs. A real browser recheck
  retained the verified 0.5 AR Strata listing through the resulting live flow:
  `.run-data/screenshots/recursive-ux/round41/incremental-listings-preserved.png`.
- Round 42 adversarially retests those new boundaries. Non-WebGL mode now omits
  otherwise invisible proof anchors; parallel settlement buckets are mutually
  exclusive and politely announce the first failed sibling while the rest
  continue; an aborted token-index delta remains uncommitted and is unioned
  into the next request; and dismissing an untouched atomic or fungible form
  does not start a refresh that disables its focus-return target. The live
  atomic control returned focus to the enabled `Buy now` button after Escape:
  `.run-data/screenshots/recursive-ux/round42/checkout-focus-restored.png`.
- Round 43 closes the remaining refresh and fallback boundaries. React
  StrictMode cleanup can no longer strand Home cards at `Checking…`; a fresh
  Home navigation resolved every visible floor and ask with zero pending
  summaries. Atomic and fungible dialogs still return focus to their exact
  enabled launch actions on ordinary dismissal, while state-changing refreshes
  now reject disabled, detached, hidden, or inert actions and fall back to the
  visible asset heading. The non-WebGL observer list remains readable while
  only its stable fallback notice is announced. Browser evidence:
  - `.run-data/screenshots/recursive-ux/round43/atomic-focus-original.png`
  - `.run-data/screenshots/recursive-ux/round43/fungible-focus-original.png`
- Round 44 follows the new boundaries into their recovery edges. Pausing a
  signed action now wins the deferred focus race and leaves keyboard users on
  `Resume pending action`; a `market-state-changed` pre-sign guard closes the
  frozen form and refreshes its parent rather than presenting the obsolete
  quote again; 100-character uninterrupted asset names cannot push the shared
  44-pixel dialog dismissal control off-screen; and a listing whose current
  compute retry fails is removed from live counts and `For sale` badges while
  verified sibling listings remain. A fresh Home pass also completed every
  market summary after the naturally slower Arweave reads:
  `.run-data/screenshots/recursive-ux/round44/home-resolved.png`.
- Round 45 adversarially follows those changes through their reachable UI.
  Atomic stale-state recovery now appears in the error phase rather than an
  unreachable form branch. `Listed for sale` still verifies every candidate
  from current HyperBEAM state, then independently orders only those verified
  listings by the latest indexed offer, reservation, transfer, or
  cancellation; recent-order failure leaves the live listings visible in
  default order with its own retry. Multi-order settlement errors announce one
  concise failure summary while the tablist, receipts, and recovery actions
  remain outside the assertive live region. A real Strata collection pass
  resolved exactly the remaining 0.5 AR live listing, displayed the temporary
  recent-order status, and removed it after ordering completed:
  `.run-data/screenshots/recursive-ux/round45/listed-recent-activity.png`.
- Round 46 extends the alert boundary to atomic recovery and contains every
  accepted 32-character fungible ticker inside balance, quote, cancellation,
  and primary-action rows. Recent ordering now uses two 100-recipient workers,
  commits completed windows, retains interrupted windows for retry, prunes
  removed listings, and queries only new live listings as paged token indexes
  grow. Pre-dispatch purchase approvals are deliberately atomic: rejecting a
  later atomic or multi-lot approval, or failing the final balance check,
  removes every signed transaction from that attempt before reporting that
  nothing was submitted. Deterministic tests cover payment rejection, the
  third and fourth multi-lot prompts, and a post-signing balance failure. Real
  browser controls retain a contained fungible dialog and the single verified
  0.5 AR Strata listing under the bounded recent-order path:
  - `.run-data/screenshots/recursive-ux/round46/fungible-dialog-contained.png`
  - `.run-data/screenshots/recursive-ux/round46/bounded-listed-recent.png`
- Round 47 adversarially tests the new ownership boundaries. Accepted
  32-character tickers now wrap inside the sell-price label as well as every
  dynamic value. Wallet balance reads carry their owning abort signal, check it
  again after resolution, and clean both atomic and multi-lot signed approval
  sets when a route or wallet changes during the post-sign balance window; the
  batch handoff also takes explicit ownership of returned IDs before checking
  abort. Deferred controls prove two atomic and four fungible approvals leave
  zero signed-key residue without dispatch or recovery when aborted. Parallel
  recent-order workers aggregate rather than overwrite failures, so identical
  mixed 429/503 responses always produce rate-limit guidance regardless of
  timing while completed windows remain committed.
- Round 48 closes three more scale, focus, and causal-state gaps. Home token
  floors now use bounded activity windows and publish no partial floor if any
  window is unavailable. Tabbing from a partial-settlement tablist enters the
  active explanation before its seller-specific recovery controls. Fungible
  transfers persist the exact fresh pre-sign sender balance, recipient balance,
  and swap height, then remove recovery only after a single later computed
  state proves the full debit-and-credit transition; an unrelated recipient
  credit cannot produce false completion. The current collection activity page
  still rendered all 18 indexed events as 18 confirmed live events without
  layout overflow:
  `.run-data/screenshots/recursive-ux/round48/activity-audit.png`.
- Round 49 adversarially corrects that preliminary transfer check and closes
  three independent UX gaps. Completion announcements now exclude receipts,
  links, copy confirmations, and CTAs; Home retains every completed bounded
  activity window while retrying only unavailable discovery work; and mobile
  fungible transfers disable address mutation while visibly echoing the exact
  destination before approval. The final transfer verifier persists the fresh
  process slot, finds the exact signed transaction in complete 100-slot
  scheduler windows, validates its committed sender, process, recipient, and
  quantity, then accepts completion only when that exact historical slot emits
  its paired `Debit-Notice` and `Credit-Notice`. An exact scheduled rejection
  is terminal and removes resumable signature state; schedule or compute
  unavailability remains safely resumable. A stock-HyperBEAM live control
  resolved transfer `QGDk3Z0niQiH9fUV84z_hblB_V6FhFqqVSvwsOZUXz8` at slot
  80 and returned the exact notice pair. Browser evidence records the contained,
  destination-reviewable transfer form at 630 pixels with zero document
  overflow:
  `.run-data/screenshots/recursive-ux/round49/fungible-transfer-review.png`.
- Round 50 follows the exact-transfer design through protocol and recovery
  boundaries. A completed Home activity snapshot is now invalidated only by a
  real membership or compute change, and obsolete StrictMode effects cannot
  release a replacement retry. Collection filter controls retain their
  conventional Tab and Shift+Tab sequence. The transfer path now sends zero
  native AR quantity so the signed `quantity` tag survives `tx@1.0` decoding;
  cancellation continues to send its required one-winston scheduler dust.
  Exact proof validation requires the transaction ID, process, sender,
  recipient, quantity, target, field target, and committed field set. Missing
  proof remains resumable; only a valid exact assignment without its paired
  debit and credit notices is terminal. Assignment discovery obtains the
  confirmed transaction block, finds its process-slot range in logarithmic
  probes, and scans only that immutable block. A deterministic 100,000-slot
  fixture remains under 45 schedule reads, and the stock-HyperBEAM slot-80
  control exposes the same commitment shape. Browser evidence shows the full
  transfer recipient and contained approval surface at 630 pixels:
  `.run-data/screenshots/recursive-ux/round50/exact-transfer-review.png`.
- Round 51 hardens those protocol boundaries through scheduler finality and
  turns the resulting evidence into clearer commerce UX. A confirmed transfer
  whose mined height changes before ten-block scheduler inclusion now discards
  only its immutable slot probes and immediately follows the new height.
  Incomplete scheduler proof remains resumable in the same open dialog because
  its exact pre-sign slot survives retry. An offline, locally signed control
  using native quantity zero and a `10^12` token tag was decoded through the
  stock `feat/name-token` `tx@1.0` modules: its body quantity was exactly
  `1000000000000`, and its commitment covered action, recipient, quantity,
  target, and the exact field target. Nothing was dispatched or spent, and all
  temporary key-derived material was removed. Exact recipients now survive in
  completion receipts, pasted whitespace is normalized before signing, and
  selected sellers render all 43 characters before approval. Narrow form text
  measures 16 pixels with a 630-pixel document width and no overflow. Modal
  tab boundaries ignore inactive roving controls, and a browser control found
  the empty polite completion node connected before the form could complete.
  Large token listing discovery now uses two 100-recipient workers, retains
  completed windows across a sibling failure, and retries only uncompleted
  IDs; the live 100-asset Strata collection still resolved its exact 0.5 AR
  listing. Browser evidence:
  - `.run-data/screenshots/recursive-ux/round51/immutable-index-guidance.png`
  - `.run-data/screenshots/recursive-ux/round51/batched-live-listings.png`
- Round 52 follows exact transaction identity back to the wallet trust
  boundary. The app now compares every signed transaction's complete target,
  native quantity, semantic tag multiset, and zero-data body with the exact
  requested fields before local persistence or dispatch; deterministic
  mutations of the action, process, recipient, native quantity, and token
  quantity are all rejected. Permanent purchase and transfer receipts visibly
  preserve complete counterparties. Large fungible matches expose complete
  seller identities as selectable text inside a bounded disclosure instead of
  creating up to 512 copy-button tab stops, and clipboard failure leaves the
  identity visible. Atomic transfers now normalize pasted whitespace, suppress
  address-altering mobile input behavior, and show the complete destination
  separately before wallet approval. A 630-pixel browser control measured a
  16-pixel input and exactly 630 pixels of document width while rendering all
  43 recipient characters; nothing was signed. Visible collection-card prices
  now share the listing filter's two-worker, 100-recipient GraphQL windows and
  retain completed windows across sibling failure. Evidence:
  `.run-data/screenshots/recursive-ux/round52/atomic-transfer-review.png`.
- Rounds 53–54 close the remaining transaction-dispatch and large parallel
  settlement boundaries. The vendored wrangler now distinguishes local
  not-sent failures, demonstrated 400/422 rejections, and ambiguous
  408/425/429/network outcomes. Deterministic registration and payment controls
  issue one terminal POST, preserve both exact pre-signed IDs, and repair only
  the rejected leg; uncertain legs still replay the same ID. Bazar exposes the
  exact seller for every irreversible action, keeps 512-seller review to one
  keyboard region, renders one stable settlement panel and one active receipt,
  and emits only bounded parallel milestones. Browser evidence:
  - `.run-data/screenshots/recursive-ux/round53/batched-activity.png`
  - `.run-data/screenshots/recursive-ux/round53/mobile-targets.png`
  - `.run-data/screenshots/recursive-ux/round54/home-retained-floor-viewport.png`
- Round 55 makes aggregate discovery recover proportionally at large scale.
  Home retains 999 successful live floor contributions when one of 1,000
  candidates fails, then retries only that candidate. Wallet candidate
  discovery commits every aliased GraphQL page atomically in memory: a
  deterministic 16,000-candidate control completed 159 pages, failed page 160,
  then resumed only that final page for 161 total requests rather than replaying
  320; every candidate reached the resolver exactly once. The UI retains its
  verified cards and live results across same-scope recovery, resets on wallet,
  gateway, support-index, or explicit-refresh scope changes, leaves interrupted
  progress indeterminate, and bounds status-only inventory work behind memoized
  groups. Responsive page-size changes no longer collapse a revealed inventory,
  late progressive arrivals cannot receive hidden-summary focus, and retry
  focus moves to the persistent resolution status. A live `arweave.net` pass
  resolved 104/104 candidates to 99 owned assets with no alert or horizontal
  overflow. Evidence:
  - `.run-data/screenshots/recursive-ux/round54/home-retained-floor-viewport.png`
  - `.run-data/screenshots/recursive-ux/round55/my-assets-resumable.png`
- Rounds 56–57 close the remaining aggregate-truth and resumable-inventory
  boundaries found by three independent audits. Single-action confirmation
  counters, success styling, fork-risk language, and completion announcements
  now move only from the same inclusion-block-aware quorum used by the network
  watcher; deterministic depth-five outlier and conflicting-block controls both
  remain at 0/5 until explicit consensus arrives. A fresh wallet/gateway scope
  hides every prior card and prior status synchronously, checkpoint failures
  can be restarted cleanly, retry recoveries survive same-scope effect replay,
  and a later activity alias invalidates only that process's prior live read
  without inflating the unique candidate total. Collection reveals retain 96
  cards when the responsive page size shrinks, and a live 48 → 96 → 100 control
  focused the visible final summary with no horizontal overflow. Evidence:
  - `.run-data/screenshots/recursive-ux/round56/wallet-refresh-focus.png`
  - `.run-data/screenshots/recursive-ux/round56/collection-final-reveal.png`
- Round 58 follows those fixes through payment recovery, accessibility, and
  large-wallet scale. A definitively rejected seller payment now retries from
  its still-valid reservation and asks only for a replacement payment. Atomic
  and fungible single actions render the exact inclusion-block-aware watcher
  consensus and clear old attempt lanes. Live keyboard controls prove visible
  modal-search focus, stable focus after search and collection clears, a
  restored alphabet tab stop, and section navigation that never claims a
  collapsed disclosure is current. Explicit `Refresh assets` bypasses the
  60-second live-state cache. Candidate announcements are bounded, while their
  adjacent visual counts remain exact. Finally, a first-pass 16,000-name
  membership partition now takes 12 milliseconds, down from the audited
  ~2.2 seconds; three complete focused-suite runs took 98, 102, and 101
  milliseconds. Evidence:
  - `.run-data/screenshots/recursive-ux/round58/search-input-focus.png`
  - `.run-data/screenshots/recursive-ux/round58/wallet-live.png`
- Round 59 closes the moving-snapshot and terminal-recovery boundaries exposed
  by three independent scale, recovery, and accessibility audits. Wallet
  GraphQL now resumes its old tail, scans back to each original head, and
  repeats until those heads are stable; a distinct transaction in the same
  block reopens only that asset. Progressive results remain visible while a
  zero-age terminal pass rechecks every positive ownership/listing result, with
  its own honest progress state. Purchase recovery no longer loops orders that
  disappeared, changed, or were reserved by another buyer, and signature
  cleanup cannot invalidate a newer cross-tab recovery. New fungible batches
  carry their fresh pre-approval balance. Keyboard refresh focus, test-wallet
  focus, transaction-map Escape ownership, status contrast, and large activity
  announcements were independently corrected and rendered. Evidence:
  - `.run-data/screenshots/recursive-ux/round59/wallet-head-closed.png`
  - `.run-data/screenshots/recursive-ux/round59/wallet-terminal-revalidation.png`
  - `.run-data/screenshots/recursive-ux/round59/fungible-refresh-focus.png`
  - `.run-data/screenshots/recursive-ux/round59/activity-bounded-status.png`
- Round 60 follows the completed scale and recovery work through three fresh
  accessibility, responsive, and protocol audits. Wallet candidate discovery
  now overlaps with bounded live resolution; a live 104-candidate pass rendered
  its first verified cards after ten candidates and completed without an alert.
  Search cannot survive a route change, header trust controls expose their exact
  wallet and gateway, functional small text meets 4.5:1 contrast, narrow headers
  no longer clip between 481 and 560 pixels, and compact order books retain every
  decision field. Recovery controls are siblings of their live messages, zero
  inventory groups remain navigable, and exact fungible sellers no longer
  collide behind shortened labels. Protocol recovery preserves ambiguous signed
  payments when live state blocks a purchase, while an already-aborted ambiguous
  POST cannot retain a 15-second timer. Evidence:
  - `.run-data/screenshots/recursive-ux/round60/wallet-overlapped-resolution.png`
  - `.run-data/screenshots/recursive-ux/round60/compact-orderbook.png`
  - `.run-data/screenshots/recursive-ux/round60/wallet-zero-group.png`
- Round 61 turns another three adversarial audits into bounded work at the
  browser, network, and library layers. Asset routes lead with current identity
  and commerce before immutable-index provenance. Rapid 512-lot selection no
  longer launches quadratic, uncancellable quote traffic: only the settled
  selection is quoted, every request owns an abort signal, and identical batch
  targets are coalesced without persistence. Search counts settle after typing,
  while a live 104-candidate wallet control advanced exact visual revalidation
  sixteen times but emitted only three speech changes (80%, 90%, completion).
  Wrangler now lazily restores and reposts the exact signed ID after durable
  `gone` consensus; repeated orphan events produce one restore and one POST,
  with no eager replay or wallet signing. Expired unpaid reservations fail on
  their first fresh-state read, preserve signed evidence, and release zero
  seller payments. Short-height forms keep their action within the modal scroll
  boundary. Evidence:
  - `.run-data/screenshots/recursive-ux/round61/commerce-before-provenance.png`
  - `.run-data/screenshots/recursive-ux/round61/wallet-bounded-announcements.png`
  - `.run-data/screenshots/recursive-ux/round61/form-dialog-normal-height.png`
- Round 62 follows those changes into mobile recovery, dense order semantics,
  and causal process execution. Asset provenance retry now measures 44 pixels
  at a real 630-pixel viewport with no horizontal overflow. Order rows no
  longer repeat the complete row before exposing their already semantic cells.
  Atomic and fungible cancellation, plus atomic and fungible transfer, persist
  their pre-sign process slot and retire recovery only after locating the exact
  signed transaction in its confirmed Arweave block, validating its complete
  `tx@1.0` commitment, and reading its immutable schedule-slot outcome. A live
  WEAVE control located cancellation `iFNmp…` at slot 7: slot 6 contained the
  exact open 2-WEAVE order and a 999,998-WEAVE liquid balance; slot 7 removed
  that order and restored 1,000,000 WEAVE. The control also proved that
  transient device event fields are not exposed in historical state, so the
  implementation validates the real before/after escrow transition instead.
  A clean browser startup now emits zero warnings or errors. Evidence:
  - `.run-data/screenshots/recursive-ux/round62/mobile-provenance-target.png`
  - `.run-data/screenshots/recursive-ux/round62/home-after-round62.png`
- Rounds 63–64 close the remaining exact-purchase, resume, short-viewport, and
  progressive-wallet scale gaps found by three independent protocol,
  accessibility, and performance audits. A live WEAVE control proved both
  seller payments in their exact scheduler slots, including the matching
  reserved orders immediately before settlement and exact buyer credits
  immediately after it. Same-height schedule reorgs now invalidate only stale
  boundary probes. Multi-seller quotes peak at eight requests. Repeated
  observer views no longer rewrite a complete 512-lot recovery record, partial
  resume emissions cannot erase its prepared payment IDs, and 512 visual state
  changes merge once per animation frame without delaying durable writes.
  Wallet discovery retains at most one resolving and one queued page; a live
  104-candidate pass rendered verified cards progressively, entered its
  zero-cache ownership pass, and completed 104/104 through `arweave.net`.
  Exact 375-by-320 browser controls kept atomic and fungible inputs fully inside
  their scroll body with a 44-pixel action footer, no overlap, and no document
  overflow. Evidence:
  - `.run-data/screenshots/recursive-ux/round63/named-task-focused-dialog.png`
  - `.run-data/screenshots/recursive-ux/round64/atomic-dialog-375x320.png`
  - `.run-data/screenshots/recursive-ux/round64/fungible-dialog-375x320-price-fixed.png`
  - `.run-data/screenshots/recursive-ux/round64/my-assets-bounded-queue.png`
- Round 65 continues the scale and responsive audit. Fungible order books
  initially reveal 50 exact rows and announce each further batch; automatic
  matching consumes at most 513 open orders even when its source contains
  100,000. Interrupted wallet discovery now exposes exactly two deliberate
  recovery paths, no inert progress bar, and one live error. At 375 pixels,
  the previously anonymous My Assets and Gateway header controls have visible
  labels, retain 44-pixel targets, and keep the document at exactly 375 pixels;
  at 359 pixels they return to the compact icon form. Collection-context cards
  no longer repeat their already visible collection title and process ID:
  the live Strata card height fell from 287 to 240 pixels and the 24-card page
  from 4,514 to 3,928 pixels, while My Assets retains full provenance. Finally,
  1,024 changed settlement snapshots schedule one durable write instead of
  1,024 full-batch serializations. Repairs and unmounts still flush
  synchronously, and the final payment gate forces a recovery-ownership write
  after its balance check before releasing seller payments. Evidence:
  - `.run-data/screenshots/recursive-ux/round65/my-assets-interrupted-clean.png`
  - `.run-data/screenshots/recursive-ux/round65/mobile-header-labelled.png`
  - `.run-data/screenshots/recursive-ux/round65/mobile-collection-compact-cards.png`
  - `.run-data/screenshots/recursive-ux/round65/live-token-orderbook-full.png`
- Round 66 follows the responsive work through asset hierarchy, large
  collection completion, and form recovery. A retained-index warning formerly
  pushed atomic artwork to document Y 956 on a 375-by-924 viewport; commerce
  now remains first, artwork begins at Y 695, and the complete 156-pixel
  provenance/retry notice follows it before detailed sections. Desktop keeps
  the same notice directly below commerce in the right column. Three exact
  collection-membership passes over 13,769 candidates and 16,653 assets
  retained all 27,537 decisions while improving from 2,057 / 1,955 / 1,455
  milliseconds to 1.99 / 0.81 / 0.76 milliseconds across three runs. Name
  membership still comes from the canonical namespace map, including unloaded
  canonical members and excluding stale loaded ones. Finally, entered invalid
  prices, quantities, recipients, and exact-match requests now populate stable
  alert nodes as they disable approval; initial instructional guidance remains
  non-assertive. A live self-transfer control exposed exactly one specific
  alert, its input remained described by that node, and its submit action was
  disabled without signing. Evidence:
  - `.run-data/screenshots/recursive-ux/round66/mobile-asset-art-before-index-warning.png`
  - `.run-data/screenshots/recursive-ux/round66/atomic-transfer-alert.png`
- Round 67 follows large-collection work through its last progressive render
  and recovery boundaries. Home and collection activity now use the exact
  indexed namespace membership created in Round 66. Live-listing resolution
  publishes one retained batch per bounded GraphQL page; a 10,000-result
  single-use control consumed every outcome once and retained all unique
  results. Carrier pagination keeps its focused control mounted with
  `aria-disabled` while loading, then transfers that same focus contract to
  the exact `Show 18 more names` continuation. Finally, a real stale
  Weave Signals #003 listing recovery whose signed intent no longer existed
  and whose live owner had changed now opens zero dialogs, removes the
  impossible local record, and creates no replacement transaction. Missing
  local intent that could still apply remains visible as a nonmodal,
  transaction-linked guard and disables replacement market actions. Evidence:
  - `.run-data/screenshots/recursive-ux/round67/pagination-focus-continuity.png`
  - `.run-data/screenshots/recursive-ux/round67/stale-operation-retired-mobile.png`
- Round 68 extends the same focus contract to Home market recovery: a
  controlled unreachable gateway formerly moved `Retry market data` focus to
  `BODY` immediately, while the corrected control stays focused through its
  busy and completed states. Exact collection lookup now builds one lazy
  per-array index; three 16,653-asset / 13,769-lookup controls improved from
  331.12 / 328.72 / 328.60 milliseconds to 1.79 / 1.67 / 1.53 milliseconds,
  with proxy tests proving one traversal and clean invalidation on a new
  snapshot. Multi-order receipt endpoints use guarded `aria-disabled`
  controls rather than removing the user’s focused pager. On the live Strata
  activity feed, each 375-pixel event fell from 256 to 165 pixels and the
  19-event document from 5,839 to 4,127 pixels; copyable actors, timestamps,
  44-pixel transaction links, and exact accessible block labels remain. The
  safe compiled-index notice fell from 139.5 to 66 pixels at the same width,
  with a 44-pixel Retry target and full desktop/live-region provenance intact.
  Evidence:
  - `.run-data/screenshots/recursive-ux/round68/home-market-retry-focus.png`
  - `.run-data/screenshots/recursive-ux/round68/mobile-activity-compact.png`
  - `.run-data/screenshots/recursive-ux/round68/mobile-index-provenance-compact.png`
- Round 69 follows the recovery and mobile-scale work through three fresh
  independent audits. A fungible order book with 25,000 listings formerly
  spent 806–969 milliseconds on membership and pre-render work before React
  created thousands of nodes; selected-ID sets and a sticky 50-row reveal now
  complete the same lower-bound work in 0.66–1.36 milliseconds. Directly
  selected lots remain first, one roving option is tabbable, intermediate
  reveal focus stays on the sticky control, and the final reveal moves focus
  to its exact status. More importantly, registration-only purchase recovery
  could previously prepare a brand-new seller payment during automatic page-
  load recovery. Atomic and mixed fungible recoveries now auto-run only when
  every exact payment transaction is already signed. Missing signatures open
  a deliberate approval review with complete sellers, seller subtotal, exact
  number of new wallet approvals, and one focused Continue action; closing it
  preserves recovery, and nothing signs or submits before that action. Live
  browser controls rendered one atomic approval and a mixed three-approval
  fungible batch without invoking either wallet. Finally, the phone-width
  names alphabet no longer hides twenty controls in an unmarked 1,306-pixel
  strip. Edge fades and 44-pixel paging controls move focus by one visible
  window, expose both directions in the middle, remove the forward control at
  `Z`, preserve the one-stop roving alphabet, and leave desktop unchanged.
  Evidence:
  - `.run-data/screenshots/recursive-ux/round69/fungible-live-after-picker-bounds.png`
  - `.run-data/screenshots/recursive-ux/round69/recovery-approval-atomic-630.png`
  - `.run-data/screenshots/recursive-ux/round69/recovery-approval-fungible-630.png`
  - `.run-data/screenshots/recursive-ux/round69/names-alphabet-affordance-start-375.png`
  - `.run-data/screenshots/recursive-ux/round69/names-alphabet-affordance-middle-375.png`
  - `.run-data/screenshots/recursive-ux/round69/names-alphabet-affordance-end-375.png`
- The current live browser validation gateway is `https://arweave.net`; a deliberately unreachable
  `http://127.0.0.1:1` control proves the UI no longer presents failed market
  reads as verified emptiness.
- The large-inventory audit resolved 104/104 wallet candidates progressively:
  the first verified cards appeared after eight candidates and the candidate
  computation completed in about 2.08 seconds. Navigating away during a fresh
  resolution produced zero stale wallet UI across 45 samples over 14.56
  seconds. Canonical names pagination rendered 25 names in 1.109 seconds and
  added 18 more in 275 milliseconds without recomputing the settled prefix.
- Broad canonical-name search committed a 13,769-match local result set in 32
  milliseconds while live price checks remained bounded to the 48 rendered
  cards. The scale review therefore made no speculative caching or debounce
  change.
- A live fallback-reference retry now changes its status to `Checking the live
  reference`, disables and relabels the retry control, preserves all 18
  previously loaded activity events, then restores the explicit fallback and
  retry state when the network reference remains unavailable.
- Current committed gates pass: 348/348 Vitest tests, TypeScript, production Vite build
  (1,909 modules), and `git diff --check`.

### Recursive UX halt and feature-series refactor — 2026-08-04

- The recursive campaign was explicitly halted after round 70. The preserved
  chronological branch is `impr/recursive-ux` at
  `fc2e42aeb45c2e6ea7e8ebd773400b8ff89ddbaa` (446 commits after the
  published fungible base).
- Round 70 added three final candidates:
  - `6a76b0a7` enlarges the mobile process-metadata link to a measured 44-pixel
    target without changing desktop layout.
  - `d0696b6` memoizes the 20,000-asset collection-activity fingerprint;
    three controls reduced repeated work from 101–106 ms to 0.55–0.57 ms.
  - `fc2e42a` forces transaction-acceptance polling through uncached process
    state so a 60-second cached reservation cannot release an irreversible
    seller payment or retire listing recovery.
- `impr/recursive-ux-feature-series` was rebuilt from the exact pre-campaign
  base `764bf28943f21ab038243c33aebeae952f906521`. The final source and
  vendored-library tree is byte-identical to the halted chronological branch,
  while the history is organized by product feature:
  - `8f19217` — network discovery and live-state resilience;
  - `00b8298` — exact, recoverable wallet operations;
  - `0d84eed` — explicit, accessible marketplace interaction;
  - `9262038` — inspectable transaction synchronization;
  - `19ca487` — scalable collection discovery and atomic commerce;
  - `1ab8e22` — resilient fungible-token commerce.
- The reorganized branch passes 348/348 Vitest tests, TypeScript, the
  1,909-module production build, and `git diff --check`.
- The untouched chronological worktree continues serving the exact halted UI
  on `http://127.0.0.1:3002/` with the permanent sample collections and live
  `arweave.net` process computation available for review.
