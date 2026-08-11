# Bazar 2.0 — Unattended Task Status

## Performance v2 mission — 2026-08-11

### Active worktrees

-   **Bazar application:**
    `/Users/sam/.codex/worktrees/bazar-mosaic-fungible-merge`
    -   Branch: `impr/perf-v2`
    -   Base: `5464859d` (`perf: stream cached market state across peers`)
-   **AO Wrangler library:** `/Users/sam/src/ao-wrangler`
    -   Branch: `feat/router-compatibility`
    -   Cache base: `e808505` (`feat: cache routed hashpath responses`)

### Commander's intent

Make Bazar 2.0 load insanely fast and responsively across all UI surfaces. The
experience must feel snappy and sharp. Do not lower asset-discovery quality;
prefer recent assets where ordering is needed. Do not weaken node-failure
protections or centralize on one node. Use real browser runs and public node
interfaces for measurement and validation. Keep the architecture maintainable,
and commit every independently demonstrated performance win. Continue until at
least 07:00 EDT on 2026-08-11.

### Explicit avenues and constraints

-   Experiment with cache policies and invocation methods rather than assuming
    existing conservative waits are necessary.
-   Investigate process `slot` / `at-slot` progress so hydration can be shown as
    useful catch-up progress (typically roughly 100 slots/sec) rather than
    treating every temporary `502` as a terminal error.
-   Public traffic only: no node login, privileged interface, destructive
    traffic, or risky load. Browser benchmarks use normal user-sized requests.
-   Preserve distributed peer routing, Retry-After handling, local adaptive
    limits, stale-while-revalidate behavior, and correctness from live state.

### Starting evidence

-   Current Bazar base passes 59 files / 552 tests and the production build.
-   AO Wrangler base passes 5 files / 81 tests, TypeScript, ESM/CJS, and DTS.
-   Current production build is deployed as manifest
    `3-3itDkgPJQafEWCaH6LK5O7PflMFjVbnaGwqjfkOaU`.
-   A real two-peer browser run renders proven listings progressively, while
    background refresh remains visible only as the Compute-header spinner.

### Work log

-   02:16 EDT: committed AO Wrangler persistent hashpath cache as `e808505`.
-   02:16 EDT: committed Bazar multi-peer cached progressive feed as `5464859d`.
-   02:16 EDT: created `impr/perf-v2`; baseline profiling begins next.
-   02:25 EDT: cold public-node baseline rendered its first proven listing at
    5.3s and the ninth at 25.4s. The collection verifier was retaining settled
    listings until the slowest sibling completed.
-   02:31 EDT: AO Wrangler now models HyperBEAM's advertised token balance as
    burst capacity while retaining sustained-rate refill, per-origin queues,
    Retry-After, adaptive decrease, and bounded recovery. Alpha and Charlie each
    advertise 180 requests / 120 seconds with a maximum balance of 600.
-   02:33 EDT: Bazar now fails GET/HEAD compute reads over from a 5xx primary to
    its stable secondary, and publishes each proven collection listing inside
    the settlement callback. A new cold browser origin against the same public
    peers rendered listing 1 at 2.0s, listing 3 at 2.2s, listing 7 at 2.4s, and
    listing 9 at 2.5s. Evidence:
    `.run-data/screenshots/perf-v2-home-progressive-burst.png`.
-   02:38 EDT: the collection resolver's independent slowest-sibling barrier is
    removed with a net source reduction: listing cards, prices, and progress now
    commit from each `onSettled` result rather than after the page batch. The
    previous public-browser names baseline stayed empty for 28.1s and then
    revealed all 11 cards at once. AO Wrangler also bounds each peer attempt so
    an indefinitely hydrating primary can fail over without abandoning the
    caller request, and the static shell now preconnects both default peers.
-   02:50 EDT: collection cards, prices, hover prefetch, and atomic-asset detail
    reads now opt into the shared AO hashpath cache. Cached state renders
    immediately across reloads; stale state revalidates once in the background
    and publishes its replacement into the same result stream. Passive tab
    visibility no longer invalidates live state, while explicit refreshes and
    post-operation refreshes still force an uncached read. The initial bundle
    now separates AO read transport from mutation-only Weave Wrangler code,
    removing 12.0 KiB gzip from the preload graph (22.3 KiB to 10.3 KiB).
    Public Alpha and Charlie were returning `429` with 10–11 second
    `Retry-After` values during the browser proof; old benchmark tabs were
    closed, and the active browser correctly remains in refreshing state until
    the shared cooldown clears rather than surfacing a false failure.
-   02:55 EDT: removed the unconditional second compute pass from My Assets.
    Cache misses are already current and now stop after one read; only a stale
    persisted result starts one shared background revalidation, which can add,
    update, or remove the wallet card before resolution completes. Strict and
    relaxed in-flight reads have separate app-level singleflight identities so
    a browse request cannot suppress a commerce-safe freshness check. Real
    warm-browser evidence through both public peers: the names collection
    progressively restored 5 cards at 746ms and all 11 at 831ms after reload;
    a cached atomic asset detail reached current owner state at 280ms. Evidence:
    `.run-data/screenshots/perf-v2-warm-names-cache.png`.
-   02:57 EDT: audio asset pages no longer download and decode the entire media
    payload during navigation. Native metadata and streaming playback remain
    immediate; expensive waveform analysis begins only after the user presses
    Play, and it no longer replaces the playing source with a second blob URL.
    This removes a full-file fetch, Web Audio decode, and large retained buffer
    from the initial asset-detail critical path without removing the waveform.
-   03:00 EDT: header search no longer rescans and resorts every collection and
    asset on unrelated market-progress renders. Activity timestamps share their
    internationalization formatters and schedule their next render only at the
    next visible second/minute/hour/day boundary, pausing entirely in hidden
    tabs instead of waking every activity list once per second forever.
-   03:07 EDT: immutable support verification now streams each proven candidate
    batch into the same bounded live-state resolver rather than gating all
    compute behind its slowest GraphQL batch. Already indexed candidates start
    immediately and the verified batches queue behind them without increasing
    compute concurrency. A fresh browser origin through both public peers
    rendered two genuine listings at 1.06s and all nine at 1.60s.
-   03:07 EDT: rejected speculative hydration polling after a real cold-process
    control. While the process is hydrating, both `compute/at-slot` and
    `slot/current` enter the same per-process persistent work group and can
    block with the original request; polling them would consume peer capacity
    without yielding intermediate progress. The app retains its accurate
    refreshing state and bounded peer failover rather than inventing progress.
-   03:10 EDT: the global Activity surface now restores its last immutable,
    collection-scoped Arweave history across reloads while the live index and
    purchase proofs refresh in the background. The bounded display cache is
    never used for ownership, listings, prices, or settlement. A cold public
    browser run produced 20 visible events at 5.49s; after a real reload the
    same current 100-event history was visible at 678ms with its refreshing
    status intact.
-   03:16 EDT: immutable collection and asset display shells now persist across
    tabs and browser restarts rather than only for one tab session. Live AO
    state, ownership, orders, and prices remain separately cache-controlled and
    continue refreshing through both peers. A public-node browser inspection
    showed the complete nine-card Discover page with only the unobtrusive
    Compute-header refresh indicator while revalidation continued.
-   03:18 EDT: one unavailable Arweave activity-recipient batch no longer stops
    independent newer or older batches from being discovered. Successful
    windows continue rendering immediately; the completed operation still
    reports the deterministic aggregate failure so retry and correctness
    behavior are unchanged.
-   03:20 EDT: experimented with persistent exact-slot state reuse, retaining
    the existing `at-slot` identity check. The final adversarial pass later
    rejected this optimization because AO device semantics can be upgraded and
    replayed even when the schedule slot is unchanged; the final implementation
    restores no-store exact-slot reads.
-   03:24 EDT: activity-list rendering and the interactive audio waveform are
    deferred until their respective surfaces are opened. The initial preload
    graph fell from 202,483 to 199,486 gzip bytes and the main application chunk
    from 99.11 to 96.11 KiB gzip. A real browser collection Activity page
    rendered all 32 indexed events with the unchanged responsive layout.
-   03:27 EDT: each collection Activity surface now restores its bounded
    immutable Arweave history from local storage while the exact collection
    window refreshes in the background. A real browser revisit to Weave Signals
    rendered all 20 initially visible events in 30ms, down from a 732ms hot-node
    read, without treating that history as live ownership or order state.
-   03:30 EDT: AO Wrangler 0.1.3 keeps Cache Storage persistence on the response
    path so a new tab can read it immediately, but moves the full key scan and
    eviction pass into background maintenance. An injected 80ms eviction scan
    now leaves writes at 0.25–4.7ms across three runs instead of imposing an
    80ms floor. The exact tested package is vendored into this Bazar branch.
-   03:34 EDT: shared asset-state reads now track their active consumers. Route,
    filter, or gateway changes abort the underlying peer request as soon as its
    last screen leaves, instead of letting obsolete work consume the configured
    nodes' capacity. A still-visible card or prefetch keeps the one deduplicated
    request alive, and cache identities now include the complete peer set.
-   03:37 EDT: AO Wrangler 0.1.4 reuses one successfully opened browser Cache
    Storage handle for every hashpath read instead of reopening the same named
    cache for each card. Parallel cache access is covered directly, temporary
    open failures remain retryable, and the exact package is vendored here.
-   03:38 EDT: individual asset Activity tabs now restore their bounded immutable
    Arweave submission history across reloads, then refresh that history in the
    background. The shared display store retains enough independent scopes for
    global, collection, and recently viewed asset histories without ever storing
    ownership, orders, or settlement truth. A real Chrome reload of the public-node
    `catsun` asset rendered all 18 recent signed events with the unchanged activity
    layout as soon as its Activity tab opened.
-   03:40 EDT: AO Wrangler 0.1.5 now fronts its existing persistent hashpath cache
    with the same bounded in-memory store after a successful browser-cache read or
    write. Repeated same-page consumers no longer re-run Cache Storage matching for
    the same process path, while reloads and new tabs still restore from persistent
    storage and retain the original age/revalidation policy. The exact vendored
    package passes all 86 AO Wrangler tests, TypeScript, and ESM/CJS/DTS builds.
-   03:44 EDT: My Assets now honors its intended zero-age
    stale-while-revalidate policy instead of nullifying it with Fetch's
    `no-store` flag. A cached ownership result may render immediately, but the
    page still waits for and applies the live revalidation before declaring
    discovery complete; explicit refreshes and transaction acceptance polling
    remain strictly uncached. After one public Alpha/Charlie load, a full browser
    reload restored all four owned assets and the terminal live-state result in
    98ms.
-   03:47 EDT: a failed collection-activity recipient window no longer prevents
    independent later windows from being queried and rendered. Successful
    history continues to stream, while the operation still rejects with the
    aggregate failure so its retry affordance and correctness signal remain.
-   03:50 EDT: service-worker activation now deletes only superseded Bazar
    static caches. It no longer erases AO Wrangler's independently owned
    persistent hashpath cache, which previously made the first activation after
    a new origin or service-worker revision silently discard warm process state.
-   03:53 EDT: global Activity now indexes collection membership once per
    immutable market snapshot. Its filters, rows, and asset resolvers no longer
    rebuild every collection's asset set for every event on every refresh render.
-   03:56 EDT: previously unseen global-activity assets now begin live-state
    resolution as each immutable GraphQL support batch is verified. The page no
    longer waits for the slowest support batch before it can identify and render
    activity for newly discovered Bazar assets.
-   04:00 EDT: the parsed in-memory asset-state tier is now a 256-entry LRU
    instead of an unbounded map. Traversing very large collections no longer
    retains every process state for the lifetime of the tab; evicted states
    remain available through AO Wrangler's separately bounded persistent
    hashpath cache.
-   04:06 EDT: AO Wrangler 0.1.6 bounds distinct stale hashpath refreshes to four
    before they enter peer transport. A warm page may still restore and
    eventually verify its complete working set, but it can no longer enqueue
    every background revalidation ahead of a user's subsequent uncached read.
    The exact package passes 87 tests and is vendored into this branch.
-   04:13 EDT: Activity caches now retain previously verified immutable purchase
    proofs when the fresh Arweave index repeats the same registration. Reloading
    Activity therefore no longer walks up to 1,000 historical schedule slots and
    recomputes before/after state for purchases the browser already proved.
    Collection Activity also merges each refreshed batch into its cached history
    immediately instead of retaining the whole stale view until the slowest
    independent batch completes.
-   04:18 EDT: fungible asset rendering now derives and price-sorts its live
    order book once per state revision. Open orders, best ask, availability,
    holder counts, and wallet-eligible orders reuse that snapshot; quantity
    keystrokes perform only a linear fill walk. In a 10,000-order control, 30
    repeated full sorts took 430.3/441.6/444.8ms while 30 sorted fill walks took
    0.86/0.55/0.68ms.
-   04:22 EDT: Home's cold listing discovery and card-state reads now stop when
    the user switches from Discover to Collections or Activity, retaining all
    resolved cards for an instant return. Hidden concurrency-eight compute work
    can no longer compete with the tab the user actually chose; collection
    floors were already isolated in the corresponding direction.
-   04:28 EDT: large-collection derivations are now keyed to their actual inputs
    rather than every progressive price/render update. Home and header search
    reuse one canonical per-collection match pass, Home retains its filtered
    collection/candidate indexes, and Collection pages reuse their activity,
    default-order, and filtered-asset indexes. Synthetic 16,000-name controls
    measured the removed duplicate search at ~9ms/render and the removed
    collection index rebuild at ~1ms/render. The real hash-route search returned
    only the exact `ventobridge` listing in 574ms including navigation and live
    price restoration.
-   04:31 EDT: route-title focus handling now disconnects its subtree observer
    as soon as the page's first real heading appears. Progressive card, price,
    and activity mutations no longer repeatedly query the entire route and
    rewrite the same document title; a real atomic route still resolved to
    `catsun — Bazar`.
-   04:14 EDT: AO Wrangler 0.1.7 gives user-initiated hashpath reads priority
    over already queued stale revalidations without bypassing the peer's token
    bucket, Retry-After cooldown, or currently admitted request. In a
    deterministic 20 req/s, burst-one control, the foreground read dispatched
    after about 101ms across three runs instead of about 256ms. Cache-hit aborts
    now stop promptly, and 100 rapid persistent-cache writes coalesce their
    full-key maintenance from 100 scans to 1–3. All 90 library tests and all
    569 application tests pass against the exact vendored package.
-   04:16 EDT: My Assets now begins live-state resolution for each immutable
    candidate batch as soon as GraphQL verifies its device contract. Known
    collection members still start first, and all verified batches share one
    bounded resolver rather than multiplying compute concurrency. A real
    Alpha/Charlie browser run reached the correct four owned assets and terminal
    live-state result with the unchanged wallet grouping and controls.
-   04:18 EDT: known fungible collection links now preload their route module in
    parallel with the existing process-state prefetch, rather than waiting for
    compute to identify denomination or supply before starting the 19.8 KiB
    route chunk. Direct token navigation also begins the import from immutable
    collection membership. In the real two-peer browser, the complete fungible
    shell rendered in 123ms and the cached live orderbook followed unchanged.
-   04:20 EDT: the first two real-image cards on collection and wallet grids now
    use eager, high-priority image loading; later cards retain lazy loading.
    This aligns their media critical path with the already prioritized Discover
    grid without increasing offscreen asset traffic.
-   04:22 EDT: every passive process read now expresses its accepted `max-age`
    through standard HTTP `Cache-Control`, even when the caller correctly
    refuses stale serving. AO Wrangler can therefore reuse those hashpaths
    across pages and browser sessions instead of caching only the subset that
    also requested stale-while-revalidate. Transaction acceptance remains
    `no-store`, and exact historical slots keep their one-year immutable policy.
-   04:24 EDT: My Assets no longer waits for the slowest live collection-index
    refresh when an immutable collection shell is already persisted locally.
    Candidate discovery and live ownership checks start from that shell while
    the manifest refresh proceeds independently. This directly removed an
    observed 16s route gate: a real arweave.net browser revisit entered live
    wallet resolution in 253ms and displayed the correct four cached-and-
    rechecked owned assets on the next 500ms observation.
-   04:33 EDT: live asset resolution now owns one bounded, activity-prioritized
    worker pool across every GraphQL page. Home discovery no longer waits for a
    page's compute or support checks before requesting the next page, and
    collection listing scans likewise enqueue each first-seen candidate and
    publish it as soon as its state settles. Later, newer activity can move
    ahead of older queued work without exceeding the global concurrency bound;
    route changes reject immediately and never start queued reads. Focused
    resolver tests pass 53/53, including cross-page capacity, recent-first
    reprioritization, and abort behavior. A warm real Alpha/Charlie collection
    route restored all 11 genuine name listings in 276ms with no UI regression.
-   04:37 EDT: global Activity now restores its exact-scope immutable history
    cache before the collection-index refresh completes. Previously the early
    `marketLoading` guard also blocked the synchronous local read, leaving a
    warm Activity surface empty behind unrelated reference traffic. Live
    GraphQL discovery, membership checks, purchase-proof verification, and
    persistence are unchanged and begin normally once the collection snapshot
    settles.
-   04:42 EDT: global Activity now verifies and resolves previously unseen
    supported assets as each GraphQL page arrives instead of accumulating them
    behind the complete 200-event scan. One two-wide live-state resolver spans
    the stream, support verification stays serialized and bounded, later events
    for an already resolved process publish immediately, and final purchase-
    proof confirmation still runs over the complete merged feed.
-   04:47 EDT: atomic asset detail no longer filters and allocates the entire
    collection merely to display four related assets. It stops after the four
    visible siblings are found. Three 10,000-call runs against a 16,000-asset
    collection dropped from 1783/1485/826ms to 0.67/0.19/0.13ms, while the
    focused search/detail helper suite passes 11/11.
-   04:48 EDT: My Assets now keeps one bounded, recent-first live-state worker
    pool open across the complete paginated wallet discovery instead of
    draining and recreating resolution work at every GraphQL page boundary.
    GraphQL pages enqueue candidates synchronously, immutable support checks
    feed the same resolver, duplicates are scheduled once, and discovery
    failures still drain already discovered candidates before surfacing. The
    obsolete page-queue implementation and its duplicate tests were removed;
    the shared resolver's cross-page concurrency, priority, and abort
    regressions cover the behavior directly. TypeScript and 67 focused wallet
    and resolver tests pass. Once the independent collection-index refresh
    cleared, a real Alpha/Charlie browser revisit entered live candidate
    resolution by 300ms and displayed the correct four owned assets with
    terminal live-state status by 1.5s.
-   04:50 EDT: Collections-floor discovery now overlaps its paginated Arweave
    index reads with one four-wide live-state resolver. Each names page or
    recipient batch enqueues first-seen candidates immediately; unchanged
    successful contributions from the same collection/gateway version are
    reused, while failed or changed candidates are retried. Listing cards and
    prices still publish progressively, but the collection floor remains the
    exact minimum and is published only after the complete index and every
    required state read settle. The focused floor/resolver gate passes 111
    tests, TypeScript, and the 1,952-module production build. The full suite
    initially exposed a stale fake-timer assumption in the exact schedule-reorg
    control: it moved the clock before the now-async routed schedule scan had
    reached its first immutable-window boundary. The test now waits for that
    observable boundary before advancing the same four-second poll interval;
    its exact two-poll/status assertions and five-second timeout are unchanged.
    That control passed three consecutive isolated runs and the complete gate
    now passes 61 files / 572 tests.
-   04:57 EDT: immutable collection payloads now decode base64url directly into
    UTF-8 bytes instead of allocating one percent-encoded JavaScript string per
    byte and passing the whole expansion through `decodeURIComponent`. Against
    the real 1.63 MB current names namespace, three old-path runs took
    85.23/78.22/70.05ms; the byte decoder took 2.41/1.66/1.62ms and produced the
    identical 1,221,326-character JSON source. Unicode manifest coverage,
    all 28 collection-index tests, and TypeScript pass.
-   05:49 EDT: a late audit caught that the byte decoder above was initially
    used only for reference-tag values, while the large `/tx/:id/data` body
    still took the percent-string path. The immutable-body reader now uses the
    same byte decoder directly. A fresh public copy of the current namespace
    measured 1,628,435 encoded bytes; three old-path decodes took
    82.03/83.83/69.35ms versus 2.47/1.56/1.82ms through the production helper,
    with identical 1,221,326-character output. The 31 collection controls and
    TypeScript pass.
-   05:02 EDT: configured immutable artwork indexes now begin loading in
    parallel with their mutable reference refreshes. Once any genuine live
    collection source succeeds, a validated compiled index can populate the
    fresh-origin shell without waiting behind a slow reference; a newer valid
    reference replaces it when ready. Provisional data cannot turn an
    all-sources-unavailable result into success. Held-reference, newer-index,
    abort, and unavailable controls pass with the complete 61-file / 578-test
    application gate and production build.
-   05:03 EDT: hidden transaction visualizations no longer retain a 60 Hz
    animation callback after the user closes them or hides the tab. Their
    mounted telemetry and lanes remain intact and resume cleanly, while opening
    an atomic operation now starts the same shared graphics import used after
    signing. Ordinary browsing still leaves the 139.51 KiB gzip graphics chunk
    deferred; 16 focused visualization tests, TypeScript, and production build
    pass.
-   05:04 EDT: global Activity now batches newly verified external-asset
    settlements into one animation-frame update instead of rebuilding and
    sorting the feed once per process. Collection Activity retains only the
    exact newest 100 events throughout multi-batch discovery rather than
    keeping and repeatedly sorting the complete history; late newer events and
    immutable purchase proofs retain the same ordering semantics. The focused
    59-test market gate and TypeScript pass.
-   05:06 EDT: My Assets now persists only completed immutable candidate scans,
    compactly keyed by wallet and GraphQL endpoint, then resumes through the
    existing fail-closed head catch-up. A realistic 16,000-candidate snapshot
    remains below 3 MB and an unchanged reload makes one aliased head request
    instead of roughly 160 history pages. New head activity is retained;
    corrupt, mismatched, and quota-limited storage falls back to full discovery;
    every restored candidate still goes through fresh live AO state. The
    focused 71-test and full 579-test gates, TypeScript, and production build
    pass. A public Alpha/Charlie collection-activity route restored and rendered
    its correct 32-event feed in under 0.5s during the browser validation.
-   05:12 EDT: a genuinely fresh browser origin exposed a progressive-index
    dependency bug: Home captured only the first available collection when its
    listing scan started and never restarted as later verified collection
    indexes arrived. Listing support is now versioned by the current immutable
    collection snapshot. Through the real Alpha/Charlie peer pair, a completely
    new origin rendered its first genuine listing at 1.509s, three at 1.614s,
    seven at 1.831s, and all nine at 2.046s instead of stalling indefinitely at
    one card.
-   05:14 EDT: an exact cached asset shell now renders and begins one passive
    live-state read while its immutable collection index refreshes. The same
    read continues when membership arrives rather than aborting/restarting.
    Commerce actions, recovery, and shell persistence remain behind an explicit
    current-index trust boundary; compiled fallbacks are display-only until a
    live reference verifies them. A real `goblinarchmagus` deep link reached
    current owner/action state in 314ms, and the warm fungible detail rendered
    its balance and order book in 13/13/14ms across three browser reloads.
-   05:16 EDT: My Assets' new completed-candidate snapshot restored the correct
    five wallet assets and terminal live-state result in 73ms on a full route
    reload after a 1.55s first scan. Explicit `Restart discovery` now removes
    only that wallet and GraphQL endpoint's candidate snapshot before starting
    again; checkpoint retry remains fail-closed. A regression with a disappeared
    GraphQL head proves two safe checkpoint failures followed by a clean restart
    against the replacement canonical head.
-   05:20 EDT: direct fungible deep links now start both their route-module
    import and passive AO state computation from the unambiguous
    `fungible-tokens` URL, in parallel with collection-index verification.
    Rendering and every commerce action remain withheld until the current
    immutable index proves membership. On a new browser origin through Alpha
    and Charlie, the correct token shell appeared at 610ms and the verified
    balance/order book at 1.324s.
-   05:22 EDT: the exact names namespace now publishes as soon as it validates,
    while the first carrier-activity GraphQL page continues in parallel. Name
    lookup and passive detail computation no longer wait behind that unrelated
    page; the populated carrier window still replaces the empty shell when it
    arrives, and abort/all-source failure behavior is unchanged. On another new
    browser origin, the real `goblinarchmagus` identity appeared at 722ms and
    its current owner/state at 1.305s through the two public peers.
-   05:25 EDT: AO Wrangler 0.1.8 exposes one shared peer warmup that begins the
    configured nodes' HyperBEAM metadata/rate-limit discovery before a visible
    hashpath read needs it. Bazar starts that work alongside its immutable
    collection refresh; later reads reuse the same per-origin promises and
    limiter state. A held-metadata control proves exactly one request per peer,
    no work dispatch before the discovered limits install, no duplicate
    metadata calls from an overlapping read, and consumer abort without
    cancelling shared discovery. All 91 library tests, TypeScript, ESM/CJS/DTS,
    and the vendored application build pass.
-   05:28 EDT: prioritized artwork now reaches Chrome as the native lowercase
    `fetchpriority` attribute. React 18 previously warned about and discarded
    the camel-case JSX prop, so the first-card/high-priority policy was not
    actually reaching the browser. Static DOM coverage proves the emitted
    attribute, and a real Home reload produced no new warning or error.
-   05:30 EDT: hiding an in-progress atomic dialog now pauses the telemetry
    rolodex's separate 360ms presentation ticker as well as the already-paused
    3D frame loop. Observer collection, queued events, and transaction state
    remain mounted; reopening drains the retained bounded queue in order. An
    empty hidden operation previously woke the main thread 83 times per 30
    seconds (1,666 per ten minutes); the scheduler now creates no timeout unless
    the dialog is visible and queued activity exists.
-   05:33 EDT: Create Collection now deduplicates identical Arweave price
    lookups and limits distinct price requests to eight in flight. The exact
    expanded `2N+2` transaction estimate is still summed, but a supported
    ten-image collection can no longer burst all 22 price reads at once.
    Controls prove repeated sizes are requested once and distinct sizes never
    exceed eight concurrent requests.
-   05:38 EDT: opening an asset now retires every unrelated hover/focus
    prefetch before its visible state read begins. Queued card sweeps can no
    longer keep draining scarce peer capacity after navigation; the opened
    process is retained and prioritized. Prefetches participate in the existing
    shared-consumer accounting, so an unrelated visible consumer keeps its
    underlying request alive. Focused controls cover two active and two queued
    prefetches, target priority, queued cancellation, and shared-request safety.
-   05:44 EDT: Create-only mint clients no longer ride in the initial
    marketplace bundle merely because their pure local asset-shell helpers
    shared a module. Those helpers now form a small read-only module that the
    marketplace imports directly; the original mint module re-exports them for
    an unchanged Create API. The main chunk fell from 98,880 to 94,644 gzip
    bytes (-4.28%), while the deferred Create chunk absorbs the mint machinery.
    Focused mint, discovery, and Home controls pass 132/132 with TypeScript and
    the production build.
-   05:47 EDT: the global language provider was removed from the application
    shell because its table is consumed only by the deferred transaction-sync
    UI and the context already supplies the identical default. A provider-free
    transaction-sync render now locks that contract. The initial chunk fell
    again from 94.86 to 93.59 KiB gzip (-1.27 KiB), and the strings moved into
    the already deferred sync chunk. Five focused controls, TypeScript, and the
    production build pass.
-   05:54 EDT: canonical name search now builds its lowercase projection once
    per immutable namespace snapshot instead of recreating 16,621 asset objects
    and lowercasing every name on each query revision. Against the current
    public namespace, a realistic eight-keystroke search sequence fell from
    28.36/27.81/27.94ms to 7.08/7.08/7.01ms cold and
    3.92/3.78/3.80ms warm, with identical results. A proxy-backed regression
    proves two different queries enumerate the namespace only once; all 12
    focused search controls and TypeScript pass.
-   05:59 EDT: removed 25 dead style rules from Bazar's retired sidebar and
    toolbar implementation. No current source or test references any removed
    selector, and the active Home, header, search, wallet, and Compute styles
    are untouched. Entry CSS fell from 144.69 to 141.07 kB and from 24.62 to
    24.12 kB gzip; the focused style controls, TypeScript, and production build
    pass.
-   06:08 EDT: the final adversarial correctness pass caught two optimizations
    that had crossed the mission's quality boundary. Home's recent-first scan
    had gained a permanent four-page ceiling; that ceiling is removed, so
    recent listings still render first while the complete Arweave activity
    history continues scanning in the background. AO Wrangler 0.1.9 now scopes
    each persistent hashpath entry to the exact routed peer set and exposes
    exact-key invalidation. Bazar uses it to evict and retry a status-200 process
    response whose body cannot be parsed as valid state, preventing a malformed
    cached response from becoming sticky. Cross-peer isolation and explicit
    invalidation pass in the library's 93-test gate; Bazar's focused cache,
    state, and Home controls pass 87/87 with TypeScript.
-   06:20 EDT: a second adversarial pass tightened cache identity to preserve
    peer order and response/quorum policy, and invalidation now retires any
    older stale revalidation before deleting its entry. Five consecutive cache
    runs pass the ordering, quorum, invalidation-race, and foreground-priority
    controls. AO Wrangler also preserves the physical response origin as
    private cache metadata, so Bazar's visible verification label names the peer
    that actually returned fresh, cached, or revalidated state rather than the
    first configured peer. AO Wrangler 0.1.11 passes 5 files / 95 tests,
    TypeScript, ESM/CJS, and declarations.
-   06:20 EDT: Home now sorts portable live listings by their indexed Arweave
    activity before applying the 36-card working-set limit; a slow newer state
    read cannot be excluded merely because an older read completed first.
    Collection `Listed for sale` + `Recent activity` begins its recipient scans
    as each live listing appears and publishes every completed activity batch,
    rather than waiting for the slowest listing computation. Restored-operation
    validation is limited to two background workers so it cannot flood the
    shared peer queue ahead of a user's visible read. The complete application
    gate passes 62 files / 596 tests, TypeScript, and the production build.
-   06:24 EDT: three exact-production, fresh-origin browser runs through the
    public Alpha/Charlie pair reached the first genuine Home listing at
    1.149/0.768/0.760s and all nine at 1.804/1.253/1.250s. Each run used a new
    site origin, retained the complete background activity scan, and ended with
    no alert. A real asset-detail control restored cached state explicitly via
    Charlie, then changed its verification label to Alpha when background
    revalidation completed, proving physical-peer provenance across both cache
    paths.
-   06:25 EDT: listed-only collection discovery no longer copies and sorts its
    complete accumulated candidate set after every GraphQL page, because cards
    are driven by progressively verified live listings and Recent has its own
    exact activity stream. This also prevents the broad discovery feed from
    overwriting Recent's ordering. A 16,000-candidate / 100-per-page control
    fell from 180.41/175.65/179.93ms to 1.08/0.74/0.80ms with the same candidate
    checksum; 123 focused discovery/Home tests and TypeScript pass.
-   06:27 EDT: Names + All assets + Recent activity now uses the existing
    recipient-batched GraphQL query for the loaded namespace window. It
    previously walked the global action index and filtered locally: the current
    public index contains 17,776,203 actions, so the route deterministically hit
    its 1,000-page safety ceiling and still omitted older relevant history. The
    initial 20-name window now resolves in one recipient query. Listed-only
    Names deliberately retains its global offer scan because it must discover
    live listings beyond the loaded card window.
-   06:35 EDT: the final cache adversary closed three correctness boundaries
    without removing the performance cache. Current process state now has one
    canonical browser hashpath; passive reads express max-age/SWR in HTTP cache
    policy, while strict reads retire any older revalidation and write the
    validated current response through that same key. Malformed background
    replacements are evicted and retried once before publication. Exact-slot
    settlement proofs are no-store because device semantics, unlike schedule
    position, can be upgraded and replayed. AO Wrangler 0.1.13 also excludes
    credentialed traffic from its shared cache, explicitly omits credentials
    from ordinary public-peer dispatch, and propagates caller aborts while
    Cache Storage persistence finishes safely in the background. The
    exact vendored package passes 97 tests; Bazar passes 62 files / 598 tests,
    TypeScript, and a 1,953-module production build (main 93.91 KiB gzip).
-   06:42 EDT: the exact final production bundle with AO Wrangler 0.1.13 was
    opened from a fresh browser origin and exercised through public Alpha and
    Charlie. The shell appeared at 66ms; genuine live cards arrived
    progressively at 1.07s, 1.19s, 1.25s, 4.41s, 4.59s, 4.72s, 4.78s, and
    4.84s. All nine cards rendered without an alert despite the public peers'
    variable late-card latency. This remains materially below the 5.3s first /
    25.4s ninth-card baseline while retaining complete background discovery.
-   06:47 EDT: progressive Home and collection listing responses are now
    committed once per animation frame. This preserves one-by-one visual
    progress while replacing an O(N²) sequence of complete Map/array copies;
    a 16,000-listing control fell from 5.47–5.78s to 57–65ms with identical
    final ordering. Names + All + Recent also reuses the completed recipient
    window when another carrier page loads, so the first ten current pages need
    10 activity batches rather than cumulatively replaying 22.
-   06:48 EDT: AO Wrangler 0.1.15 completes the cache safety pass by cancelling
    the response body abandoned when a caller aborts during browser persistence.
    Its 97-test suite, TypeScript, ESM/CJS build, and declaration build pass.
    The exact package is vendored locally for the final Bazar gate.
-   06:50 EDT: the exact committed 0.1.15 Bazar tree passes 62 files / 600
    tests, TypeScript, and the 1,953-module production build (main 94.33 KiB
    gzip). A fresh browser origin through public arweave.net rendered
    its shell at 128ms, first genuine listing at 456ms, and all nine at 977ms,
    with no alert. The names collection then progressed from one visible live
    listing during compute to 11 resolved live listings without a warning; the
    known 10 AR name detail rendered live state with no alert.
-   06:53 EDT: three fresh-origin controls explicitly configured with both
    public Alpha and Charlie reached all nine genuine listings in 3.415s,
    2.833s, and 2.176s, with progressive intermediate cards and no alert. This
    exercises the production peer list rather than the local-development
    arweave.net default, and remains far below the original 25.4s ninth-card
    control without removing either peer or truncating background discovery.
-   06:54 EDT: final flake controls passed three consecutive complete AO
    Wrangler runs (97/97 each) and three consecutive complete Bazar runs
    (600/600 each). Both worktrees are clean; no test assertion, peer policy,
    discovery ceiling, or error condition was relaxed to obtain the result.
-   06:55 EDT: the built `dist/` output—not the development server—was served
    from a fresh origin with explicit Alpha/Charlie routing. Its shell rendered
    at 44ms, the first genuine listing at 988ms, and all nine at 1.907s. The
    configured-peer label named both nodes and the page contained no alert.
-   06:56 EDT: the same built bundle was visually reviewed at 1440×900. The
    responsive three-column grid, asset media, prices, filters, peer controls,
    and subtle header refresh indicator rendered cleanly; the old alarming
    market-data banner was absent.
-   07:00 EDT: the unattended performance campaign completed with both
    worktrees clean. Every local Vite/preview server and diagnostic process
    started by this task was stopped; no public deployment or remote push was
    performed.

## Isolated worktrees for this task

-   **Bazar application:** `/Users/sam/.codex/worktrees/bazar-2-arweave-native-20260730`
    -   Branch: `feat/arweave-native-marketplace`
    -   Base: `ed511d9cdec2ab76b11423e1eac392b794915444` (`main`)
-   **HyperBEAM runtime:** `/Users/sam/.codex/worktrees/bazar-2-hyperbeam-20260730`
    -   Detached at `35c41dfb86b6b369cd5d9e52978976f778b091c3`
        (`feat/name-token`)
    -   Runtime/test base only; no edits planned
-   **Token device:** `/Users/sam/.codex/worktrees/bazar-2-token-device-20260730`
    -   Branch: `feat/arweave-swap-assets`
    -   Base: `2125c08` (`main`)

## Mission — verbatim

Thanks. Please now turn your attention to a new task:

-   Please make yourself a worktree of the Bazar atomic asset marketplace. There is a checkout in `~/src/bazar`.
-   Your mission in unattended mode is to: Please modify Bazar such that it is focused on trading Arweave-scheduled (`~arweave-scheduler@1.0`), Arweave-native swapped (`swap-device: arweave-swap@1.0`) token-compatible (`~/src/devices/token@1.0`) assets.
-   Assessment criteria: You will implement the **entire** system, end-to-end, _without any gaps_ and _without over-engineering_. Re-use as much of the existing infrastructure and components as you can, as well as the same weave-wrangler/AO-Site-style payments flow -- just as you did for name re-sales in `~/src/ao-site`. Before halting you MUST demonstrate, collecting screenshots of the entire process end-to-end, multiple parties buying and selling assets from one another in both of the collections described below. Your finished product before halting will be Bazar 2.0 as a fully-functional on-chain, decentralized marketplace.
-   The initial 'collections' of assets will be all available `~carrier@1.0` names, just like in the AO-Site, as well as two randomly generated PNG collections with 100 assets each. You should upload these with '[TEST]' somewhere in their collection name. I would suggest using the `~/src/devices/reference@1.0` device (to load into your HB just add a `trusted-devices/reference@1.0: ImplementationID`, as `arweave.net/~meta@1.0/info/trusted-devices` does) as your collection indexes in the new system. The new image asset collections should be constructed as `device: ~process@1.0` messages with `execution-device: token@1.0`, `swap-device: arweave-swap@1.0`, and `scheduler-device: arweave-scheduler@1.0`.
-   When you need AR to test with (it will be the only base-pair currency for now), please use `~/src/Documents/hyperbeam-key.json`. Do not exceed a budget of 50 AR (ideally much less than that).
-   You MUST add zero backend servers that the site is dependent upon -- instead, like AO-Site it should load from any HyperBEAM gateway, and perform its compute requests on `GET /ProcessIDRelativePaths`.
-   You MUST change existing devices only **precisely minimally**. You will depend upon the same HyperBEAM `feat/name-token` branch as a base (starting a new worktree if you have to modify it at all), and `~/src/devices/token@1.0`. You may need to replicate the `swap-device` pattern from `~carrier@1.0` into `~token@1.0`, but this is likely the only base-layer device edit that will be required.
-   Please re-use the transaction syncing screen from `AO-Site` and the weave-wrangler library below it to ensure that while the user waits for the message to sync, they have a clear understanding of what is happening.
-   Please remove all 'profile' functionality from the system cleanly and fully, such that end-user wallets become the true owners of assets directly.
-   Please ensure that all legacynet AO-Connect push behaviors (etc.) are completely removed, and we are left with only the clean purchase, offer, transfer APIs of the new devices. I would recommend removing the AO-Connect library entirely so that you can be sure that you have found all of the places that it could show up.
-   Finally, please deep clean (purge would be a better word!) all of the old 'announcements', 'migration', etc., references in the site. Ensure that every single screen is clean, clear, and usable. You are not testing unless you are taking and looking at screenshots to see how the app is working from the user perspective. The bar here is that the UX is clean, clear, and beautiful. The network syncing may take some time but the user is never left guessing what is happening. Additionally, error/refresh recovery should be smooth and clean.

This will be an extremely intense and complex overnight task. It is also highly important. You must be patient and do not rush. Take as long as it takes. You MUST not stop until it is absolutely and fully completed. Please begin by ensuring that this full message is in your STATUS.md verbatim, along with ensuring that your isolated worktrees for this task are clearly labelled at the top of the file. Re-read this document in FULL every time your context compacts, or when you are unsure how to proceed, or believe that you have completed the task. Iterate relentlessly until every single requirement above is met.

Continue now in overnight unattended mode. Godspeed!

## Current state

-   The Bazar application has been rebuilt as a browser-only marketplace for
    Arweave-scheduled, Arweave-native swap assets. The replacement is 6,965
    source lines and builds 123 modules versus the baseline's 35,788 lines and
    1,499 modules.
-   The minimal `token@1.0` composition change is committed independently as
    `7f686b3` on `feat/arweave-swap-assets`. Its complete 39-test packaged-device
    run, `rebar3 device verify`, and `rebar3 device package` passed.
-   The carrier-name collection is discovered from Arweave using the current
    AO-Site mechanism and contains 16,653 live candidates. It is paged rather
    than eagerly computed.
-   Two permanent 100-piece test collections were generated, uploaded, and
    indexed through `reference@1.0`:
    -   `[TEST] Permanent Strata`:
        `A7TGD0bktXYkQSrz4UWfPqgcb8A4TAOEsKQU5_zAu7g` →
        `8aITB5SF-jc9MXx9IuCe_RaAoOrUHkkvgsy0cmLNCQw`
    -   `[TEST] Weave Signals`:
        `IMKioUfmOrqtTnrLO3_Jpg5zv8zg8PKjWYNVhD3xsZM` →
        `EK3bWZ0yvkYZ8btaPw0q-fNWsKLUeOeq3blqhRQlQJg`
-   The complete publication ledger contains exactly 200 PNG transactions, 200
    process transactions, two manifests, two references, and funding. Exact
    publication/funding spend was 6.607545696784 AR; all marketplace/control
    actions including the inventory extension totalled 1.235823878375 AR.
    Combined spend is 7.843369575159 AR, far below the 50 AR limit.
-   Two independent parties completed reciprocal browser-driven sales in both
    collections, including listing, registration, exact native-AR payment,
    five-confirmation observer consensus, scheduler application, reload
    recovery, and return sale:
    -   `1uTLV5GvfQ5M46Tq_DTeJL7rIy7vCAOMxQ7Fbf82YZw`
    -   `BLyLiOZptmb-olB8wycvk_ynHiu1SZMKPqswx4KONwc`
-   Final live state at Arweave tip 1,970,053 proves Permanent Strata #001 is
    owned by party A and Weave Signals #001 by party B; both order books are
    empty and both settled at scheduler height 1,970,043.
-   Final owner and responsive browser evidence:
    -   `.run-data/screenshots/e2e-final-strata-owner-party-a.png`
    -   `.run-data/screenshots/e2e-final-signals-owner-party-b.png`
    -   `.run-data/screenshots/e2e-strata-party-a-return-purchase-applied.png`
    -   `.run-data/screenshots/e2e-signals-party-b-return-purchase-applied.png`
-   Production build, all 17 application tests, script syntax checks, dependency
    validation, `git diff --check`, and forbidden-surface scans pass. No
    AOConnect, profile, UCM, Redux, announcement, migration, service-worker,
    backend, mocked telemetry, or machine-specific source path remains.
-   The selected HyperBEAM gateway performs both process computation and browser
    observer relays. The purchase observer fanout is bounded at 12 to preserve
    responsive local and remote gateway operation while retaining independent
    quorum evidence.
-   The full browser-visible flow remains recoverable across refreshes without
    re-signing: only transaction IDs and deterministic purchase metadata are
    persisted; live computed state remains marketplace truth.

## Mission extension — verbatim

Thank you. Being careful to ensure that your solution is robust but not over-engineered, please commit your work on branches as necessary and then implement and test the following fully:

Add a fast, backend-free `/my-assets` (“My assets”) page. Discover candidate process IDs with one paginated Arweave GraphQL using aliases for: assets whose initial-holder is the connected wallet; register-interest or make-offer transactions signed by it; and transfer transactions whose recipient tag names it. Reuse AO-Site’s traditional carrier discovery where required. Deduplicate candidates, restrict them to supported collections/devices, then compute live state through the selected HyperBEAM gateway with bounded concurrency. Only live state determines ownership; GraphQL is candidate discovery.

Reuse the existing asset cards and state helpers, grouping results into “Owned” and “Listed for sale.” Render progressively starting with the assets with the most recent activity, show resolution progress, support retry, and abort cleanly on wallet/gateway changes. Do not scan entire collections, persist marketplace truth, add profiles/backends, or request a signature. Add “My assets” to the connected-wallet header. Validate with both test parties: purchases and transfers must move assets between their pages, listings must appear under “Listed,” refresh must preserve correct results, and sold assets must disappear.

Finally, collection pages must be able to be filtered for only assets that have a live listing, and sorted by recent activity or 'Default' (as you have it now).

Focus on making sure that even with very large asset groups, the UI is clean, simple, and fast to load. List a number of test assets for sale before returning. Once you are certain that you have finished commit your work again.

## Mission extension status

-   The completed Bazar 2.0 baseline is committed as `aae26f8`.
-   `/my-assets` now uses one paginated GraphQL operation with aliases for
    `initial-holder`, wallet-signed `register-interest`/`make-offer`, and
    recipient-tagged transfers.
-   Immutable creation tags eliminate unsupported initial candidates before
    compute. The remaining candidates resolve progressively, newest first,
    through eight bounded live-state workers. No marketplace result is persisted.
-   The page groups reused asset cards under `Owned` and `Listed for sale`,
    reports discovery/resolution progress, retries cleanly, and aborts on route,
    wallet, or gateway changes. A browser navigation at 65/102 live resolutions
    produced no stale-state or abort error.
-   Collection pages expose `All assets`/`Listed for sale` and
    `Default`/`Recent activity`. Image activity queries are scoped to the 100
    collection process recipients. The names listing query discovers only
    `make-offer` candidates globally, then verifies their live state.
-   Real-network browser validation completed with these exact transfer/listing
    actions:
    -   Permanent Strata #002, party A → party B:
        `QGDk3Z0niQiH9fUV84z_hblB_V6FhFqqVSvwsOZUXz8`
    -   Weave Signals #002, party B → party A:
        `tAgkXN0V7RceSLJCWFGWvEJwRCZokKH4y7SHCVwwkUc`
    -   list Permanent Strata #001:
        `S09vnf099nqn8oACEJhdZGI3SCQ8vWVMFgkLRFel_iE`
    -   list Permanent Strata #003:
        `JuHOTT0-YJpqj18fmEiQUJu8JCHiLrXPcFTBsVb8ID0`
    -   list Weave Signals #001:
        `XdqyEKOj0p5wJGbAJ2kMbVo6DQLFk1wGrPulefje97A`
    -   list Weave Signals #003:
        `LZwFzF5FrXGGoBJmm2A9ani1axx_ZZmNenO1335UzyE`
-   Both parties then bought the other collection's #003 asset through the full
    browser payment flow:
    -   Party B bought Permanent Strata #003:
        -   reservation:
            `M68KpEwj8zw9OgL-5oe_DuMPE4ZOdDJ4JtE1EtMltes`
        -   exact 0.0001 AR payment:
            `XLByXT_hHsu5H8JK0I3ocxVgHcLmReiIM9Q5amtadJc`
    -   Party A bought Weave Signals #003:
        -   reservation:
            `hNBxEJmaYudWOVI5iTMkw2etuCLd4IPwUInau0WeTtM`
        -   exact 0.0001 AR payment:
            `q333GVTMP-2pLlmykThZVxil6jy-t55VNvYVRzEmErA`
    -   both reservations mined at 1,970,087; both payments mined at 1,970,098;
        both dialogs reported `Applied to live asset state` at tip 1,970,109.
-   Final live computed state proves:
    -   Permanent Strata #001 remains an open listing by party A;
    -   Weave Signals #001 remains an open listing by party B;
    -   Permanent Strata #003 is unlisted and owned by party B;
    -   Weave Signals #003 is unlisted and owned by party A.
-   Both `/my-assets` pages resolve 103 candidate processes to 99 `Owned` and one
    `Listed for sale`. The sold #003 disappears from its seller and appears for
    its buyer. A true page reload and wallet restoration reproduced the same
    results for both parties without signing.
-   Final collection tests prove:
    -   each live-listing filter returns only the remaining #001 listing;
    -   the sold #003 is absent;
    -   `Recent activity` puts the newly settled #003 first;
    -   `Default` restores #001-first manifest order.
-   Browser evidence:
    -   `.run-data/screenshots/purchase-signals-party-a-applied.png`
    -   `.run-data/screenshots/purchase-strata-party-b-applied.png`
    -   `.run-data/screenshots/my-assets-party-a-after-purchases.png`
    -   `.run-data/screenshots/my-assets-party-b-after-purchases.png`
    -   `.run-data/screenshots/collection-strata-live-listings.png`
    -   `.run-data/screenshots/collection-signals-live-listings.png`
-   The live transfer test exposed one precise token-device defect: Arweave tag
    values deliver `quantity` as a binary (`<<"1">>`), while `transfer/3`
    required an integer. `dev_token` now normalizes numeric wire values with
    `hb_util:safe_int/1`, covered by a packaged end-to-end owner-transfer
    regression. All 40 packaged device tests, `rebar3 device verify`, and
    `rebar3 device package` pass. The minimal fix is committed as `0542eaf` on
    `feat/arweave-swap-assets`.
-   Final application gates pass: 17/17 Vitest tests, TypeScript, production Vite
    build (124 modules), dependency validation, `git diff --check`, forbidden
    legacy/backend scans, and the real two-wallet browser acceptance run.
-   Extension actions cost 0.616632651529 AR including both 0.0001 AR payments.
    Combined mission spend remains 7.843369575159 AR, below the 50 AR ceiling.

## Final mission — verbatim

Thank you. Now your final task for the evening: Please backport the aesthetic _style_ (not the exact implementation) of the original onto your new version of Bazar. Bazar has many fans that enjoyed its UI, so we should offer them a cleaner, smoother, and fully decentralized experience -- but with a familiar aesthetic theme. Please update it slightly to be smoother, sleeker, and more modern, but still largely true to the original vibe of Bazar. That means that we want the asset listing page to look similar, too: Showing UDL/license properties if present, an orderbook (even if these _particular_ assets only have one offer at a time as they have one unit), and if possible, an activity page for collections. All of the prior rules of this build still apply: Keep it clean, fast, and fully decentralized.

Once you are done, publish a version of your `token@1.0`, then demonstrate that we can load it by its implementation ID (alongside our `reference@1.0`) in a standard HyperBEAM node only running the `feat/name-token` branch. Please run your complete circuits of buying and selling assets, checking they appear in your `my-assets` page, filtering and sorting by activity on collections, and re-listing and purchasing. Once all of these components work please commit your work and then deploy the new Bazar UI itself and check it loads correctly from arweave.net (using your local HyperBEAM node with token@1.0 loaded for compute). Commander's intent: Have Bazar 2.0 ready to deploy as soon as your turn completes. We will load your `~token@1.0` onto our production nodes, then my team will start to use it.

This is the final challenge. You have done exceptionally well so far. Time to get it over the line. Stay focused. Godspeed!

## Final mission status

-   Complete. The original Bazar visual vocabulary is restored in a smoother,
    responsive application without restoring profiles, UCM, AOConnect,
    announcements, migrations, backends, or any other legacy architecture.
-   Published `token@1.0`, implementation-ID cold loading, two-wallet market
    circuits, live inventory recovery, collection listing/activity views, and
    Arweave production-origin validation all pass.
-   Deployed Bazar manifest:
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

-   **Application scope:** Bazar may be rewritten and deep-cleaned freely against
    the contract above. Existing visual atoms and useful asset renderers should be
    retained when they fit.
-   **Kernel scope:** HyperBEAM is substrate. Work from `feat/name-token`; change
    it only if a concrete device/runtime defect blocks the contract.
-   **Device scope:** `token@1.0` may receive only the smallest changes necessary
    to compose with `arweave-swap@1.0` and seed an on-chain one-unit asset. The
    existing carrier, scheduler, swap, and reference devices otherwise remain
    unchanged.
-   **Network scope:** Public uploads explicitly required by the mission are
    allowed. Production node configuration changes are not implied.
-   **Funds:** `/Users/sam/src/Documents/hyperbeam-key.json`; hard ceiling 50 AR.
    Record before/after balances and every uploaded transaction. Prefer the
    smallest practical spend.
-   **Processes:** Do not stop or modify services not started for this task. Tear
    down task-local nodes and development servers when validation finishes.

## Public contracts

### Asset process

-   Arweave transaction message with:
    -   `device: ~process@1.0`
    -   `execution-device: token@1.0`
    -   `swap-device: arweave-swap@1.0`
    -   `scheduler-device: arweave-scheduler@1.0`
    -   `scheduler-mode: all`
    -   one indivisible initial unit held directly by an Arweave wallet
    -   immutable display metadata identifying collection, name, and PNG data
-   Browser reads through `GET /<process-id>/<relative-path>`.
-   Token actions: `transfer`.
-   Swap actions: `make-offer`, `cancel-order`, `register-interest`, followed by
    an ordinary native AR payment to the seller carrying `order-id`.
-   Live ownership and orders come from scheduled process state, not an indexer
    database or browser cache.

### Collection

-   A `reference@1.0` value is the durable collection index.
-   The referenced value contains collection metadata and the ordered asset
    process IDs.
-   The names collection merges all available `carrier@1.0` assets discovered
    from Arweave with the same manifest/carrier mechanism AO-Site uses.
-   Collection discovery must be possible from Arweave/HyperBEAM alone.

### Transaction synchronization

-   Use the current `weave-wrangler` state machine and AO-Site transaction-sync
    visualization.
-   Persist only resumable transaction IDs and deterministic purchase metadata.
-   Do not cache marketplace truth.
-   Never dispatch the payment until the registration satisfies the configured
    network propagation/confirmation threshold.
-   Explain propagation, confirmation, scheduler inclusion, failures, and safe
    recovery in the UI.

## Baseline evidence

-   Bazar base: `ed511d9cdec2ab76b11423e1eac392b794915444`
    (`main`, 2026-07-30 checkout).
-   Source: 412 files, 35,788 lines under `src`.
-   Largest module:
    `src/views/Asset/AssetAction/AssetActionMarket/AssetActionMarketOrders/AssetActionMarketOrders.tsx`
    at 1,725 lines.
-   Legacy dependencies include `@permaweb/aoconnect`,
    `@permaweb/aoprofile`, `@permaweb/libs`, `@permaweb/ucm`, Redux persistence,
    and the AO Sync provider.
-   Profile state spans routes, two providers, Redux, wallet UI, asset ownership,
    collections, orders, and campaign screens.
-   `package.json` has no functional test command: `"test": "npm test"` recurses.
-   Existing write APIs use `helpers/aoconnect` in legacy mode.
-   Baseline production build passed:
    `npm run build:production` (`vite v6.4.3`, 1,499 modules). The largest output
    chunk was 16.86 MB uncompressed / 4.59 MB gzip.
-   Baseline UI screenshots:
    -   `.run-data/screenshots/baseline-home.png`
    -   `.run-data/screenshots/baseline-home-full.png`
        The landing page is dominated by old promotional collections and exposes a
        profile-shaped wallet control; this is replacement evidence, not a target to
        preserve.
-   HyperBEAM base worktree already exists at `/Users/sam/src/hb-name-token`,
    branch `feat/name-token`, commit
    `35c41dfb86b6b369cd5d9e52978976f778b091c3`.
-   Current network `reference@1.0` implementation:
    `dRkm83Whq0qNE6We0oekl9Ngymgb7y3Otr-Smlatn54`, read from
    `https://arweave.net/~meta@1.0/info/trusted-devices`.
-   Current standalone `token@1.0` source:
    `/Users/sam/src/devices/token-1.0`, commit
    `2125c08` on `main`.

## Immediate audit findings

-   `arweave-swap@1.0` already implements the complete escrow/reservation/native
    AR settlement contract and is covered by extensive device tests.
-   `carrier@1.0` already demonstrates the required scalar `swap-device`
    composition pattern.
-   Standalone `token@1.0` does not currently delegate scheduled assignments to
    its configured swap device, and its on-chain process definition has no scalar
    initial-holder seeding path. These are the two minimal device changes now
    implemented in its task worktree.
-   Existing token ledgers canonicalize account keys, while
    `arweave-swap@1.0` settles against exact, case-sensitive L1 signer addresses.
    Swap-configured token ledgers must therefore preserve exact keys. The existing
    canonical behavior remains unchanged for every token without `swap-device`.
-   The existing Bazar application cannot be incrementally stripped with
    confidence: its profiles, UCM/AO writes, Redux persistence, providers,
    routes, and views are mutually coupled. The selected deep-clean strategy is
    a clean application-surface replacement retaining only fitting visual assets
    and the proven AO-Site/weave-wrangler transaction system. See
    `decisions/application-rebuild.md`.
-   The carrier namespace bootstrap is the current Arweave manifest
    `fQXYPE9MAcfI1wV2CwJ3sJIhgT9btBOlYFOKFDGhAs0`, containing 16,621 names.
    Collection browsing must page/search this index and compute only viewed
    details or live offer candidates; eagerly computing every name is forbidden.
-   Image collection indexes will be `reference@1.0` init messages whose scalar
    `reference-value` points at an immutable JSON collection manifest. This
    matches the device's documented foreign-message pattern without inventing a
    backend or a nested on-chain encoding.

## Final mission progress

-   The modernized original-Bazar visual system is implemented with bundled
    Quantico/Inter WOFF2 fonts, the familiar cart/mountain mark, the original
    monochrome/coral palette, dot-grid surfaces, and current responsive layout.
-   Collection pages now have `Assets` and backend-free `Activity` views.
    Activity is a bounded, collection-scoped Arweave GraphQL history; it is never
    treated as ownership or listing truth.
-   Asset pages now render the live one-unit order book and only UDL/license
    scalar properties actually declared by process state.
-   Current app validation:
    -   `npm run typecheck`
    -   `npm test -- --run`: 19/19 tests pass
    -   `npm run build`
    -   `git diff --check`
-   `token@1.0` source remains the committed
    `0542eaf0067054f058fbeb5e558b47f046eb7e8b`.
    `HB_PORT=0 rebar3 device test` passed all 40 tests, including native/hyper
    parity, swap settlement, offer/cancel, transfer ownership, and wire quantity.
    `rebar3 device verify` and `rebar3 device package` also passed.
-   Published once:
    -   specification:
        `7LWK7RCyMKCZ1uiANJ5At1vfsiwra1T_5xkBG3X_so0`
    -   implementation:
        `TmTc-Tjo8WWrp6Th8Kgqs7azjIKHgyNIcvZ6NW-zvps`
    -   signer:
        `eFNj8Xo_fbPWkEFL47YgEHctsxs03jk6fSGDr_xTiFY`
-   The token branch now ends at documentation commit `0b17c5f`, which records
    those published IDs; implementation source remains the tested
    `0542eaf0067054f058fbeb5e558b47f046eb7e8b`.
-   A clean HyperBEAM checkout at exact `feat/name-token` commit
    `35c41dfb86b6b369cd5d9e52978976f778b091c3` is running on task port 3101.
    Its metadata reports the published token implementation and the production
    `reference@1.0` implementation
    `dRkm83Whq0qNE6We0oekl9Ngymgb7y3Otr-Smlatn54`.
    A cold computation of Strata #001 returned `execution-device: token@1.0`,
    its live escrowed order, and the exact current state without source-preloading
    the token repository.
-   The two-party final circuit is in flight:
    -   Party B Strata #001 registration:
        `u_jgUobBkZPiI1uNl5Qd4WA09L1YFP59TZ90CywiJ7k`
    -   Party B → Party A seller payment:
        `YE9df6nXUoe9d-QB-KkxvtceR-FUzQ1AqI2tuhgEdzc`
    -   Party A Signals #001 registration:
        `CSGyP7ecdUcbFqOQCwlgio9N0CVAPeCYp1OzT-iyXRs`
    -   Party A → Party B seller payment:
        `4hSlysFohDhY2g8ikn45O5A19QlTQOJgjUPcloXj9Gs`
        Bazar has already demonstrated exact signed-transaction recovery after a
        wallet-context change and a compute-node restart; no transaction was signed
        twice. Each payment remained local until live state showed its matching
        scheduler reservation.
-   Party B has also re-listed the already purchased Strata #003 through the UI
    at 0.0001 AR. The signed listing transaction is
    `i-59CVHojfCzMPqGFfPqB0xHWx3Gl5KzoRfV6GSsfCA`; its transaction-sync screen is
    preserved as `relist-party-b-sync.png`.
    Its preceding completed sale is independently visible as listing
    `JuHOTT0-YJpqj18fmEiQUJu8JCHiLrXPcFTBsVb8ID0`, reservation
    `M68KpEwj8zw9OgL-5oe_DuMPE4ZOdDJ4JtE1EtMltes`, and native payment
    `XLByXT_hHsu5H8JK0I3ocxVgHcLmReiIM9Q5amtadJc`; live state now names Party B
    as owner.
-   Once that re-list appeared as an open live order, Party A started the
    buy-back through the rendered order book. The new registration transaction
    is `lKj6GTVlV-1Lup0_P8Y1x1-pRhtFOfGbwVBTiTqFCk0`; its native payment remains
    signed but undispatched until the scheduler reservation becomes live.
    After that exact live-state transition, Bazar released payment
    `YaQMEaaMAnpFIAlupt9bD6voG03JPOcHpTsnqLaXSwk`.
-   The buy-back settled at `swap-height` 1,970,169: Party A owns Strata #003
    and the order book is empty. The asset page refreshed to that live state.
-   Final, refreshed 103/103 inventory checks:
    -   Party A: Signals #003 listed; Signals #001 and Strata #003 owned.
    -   Party B: Strata #001 listed; transferred Strata #002 owned; sold Strata
        #003 and Signals #001 absent.
    -   Evidence: `my-assets-party-a-final.png` and
        `my-assets-party-b-final.png`.
-   Party A listed Signals #003 at 0.0002 AR for the final live marketplace
    inventory. Its transaction is
    `z0YQvZ3K5t7Ambyr7OjEf8A79_fLBhP6bITvb52oZfc`.
    Live Signals state now contains that open order, and the collection's
    `Listed for sale` + `Recent activity` view resolves exactly one result:
    Signals #003. Evidence: `signals-live-listing-filter.png`.
-   Strata #001 settled to Party B in live state with no remaining order, proving
    the registration/payment pair above completed. Party B then re-listed that
    newly purchased asset at 0.0003 AR through the UI:
    `xPq4nbitLwypaokKrEisl0_Bul7Cfz088ef77qIcA9w`.
    Live Strata state now contains that open order at 0.0003 AR, so the final
    marketplace has open inventory in both test image collections.
-   Signals #001 then settled to Party A. Fresh 103/103 live-state inventory
    resolutions showed Strata #001 under Party B and Signals #001 under Party A;
    after retrying Party B's page, the sold Signals asset and its listing
    disappeared. Corresponding screenshots are
    `my-assets-party-b-sold-disappeared.png` and
    `my-assets-party-a-after-purchase.png`.
-   Current final visual evidence lives under
    `.run-data/screenshots/final-ui/`.
-   The exact application build at
    `2c03841b83813387ad063d151cc0640c4cb0d10b` was published as 14 ordinary
    Arweave file transactions and a standard `arweave/paths` manifest:
    `aoehUhJcxoKQl93_X2uXYxborLgHQReTFZ2VWHtCYhc`.
    Upload cost was 0.094402935091 AR, bringing total mission spend to
    7.937772510250 AR.
-   Arweave mined the manifest in block 1,970,182. A fresh production-origin
    browser session loaded the security-sandboxed Arweave URL, the bundled
    fonts/images/application chunks, and the complete Bazar home.
-   A temporary GET/HEAD/OPTIONS-only HTTPS tunnel to the task-local standard
    HyperBEAM node proved that the deployed origin computes through the node
    whose trusted-device map loads published `token@1.0`. The deployed asset
    page returned the current Party B owner, 0.0003 AR open ask,
    `execution: token@1.0`, native-AR settlement, supply 1/1, and the rendered
    live order book. The tunnel was validation infrastructure only and is not
    part of Bazar.
-   From the deployed build, the Strata collection's `Listed for sale` +
    `Recent activity` controls resolved exactly one current listing, and its
    Activity view rendered the permanent listing, transfer, and reservation
    transactions from both test parties.
-   Production evidence:
    -   `.run-data/screenshots/final-ui/deployed-arweave-live-orderbook.png`
    -   `.run-data/screenshots/final-ui/deployed-arweave-collection-activity.png`

### Cold-runtime dependency control

-   A never-before-requested Strata asset initially failed on the clean node
    with `device_not_loadable: security@1.0`. This was an operator-configuration
    miss, not a token implementation defect: `token@1.0` deliberately composes
    the published `security@1.0` and `process-outbox@1.0` devices documented by
    its repository.
-   The clean node now pins those two published dependencies in addition to
    `token@1.0` and `reference@1.0`; no HyperBEAM or token source was changed.
-   The same cold asset then computed successfully through the published token
    implementation. Its live state reports Party B as owner, matching the real
    Party A → Party B transfer
    `QGDk3Z0niQiH9fUV84z_hblB_V6FhFqqVSvwsOZUXz8`.
-   A second standard node on port 3102 used a brand-new isolated store and the
    exact `feat/name-token` commit. Its metadata exposed the four pinned device
    IDs, then first-request computations of Strata #002 and Signals #002 both
    returned HTTP 200, `execution-device: token@1.0`, and their correct,
    different live owners. The control node and its temporary config were
    stopped and removed immediately afterward.

## Fungible purchase UX mission — 2026-08-04

### Isolated worktrees

-   **Bazar UI:**
    `/Users/sam/.codex/worktrees/bazar-fungible-purchase-ux-20260804`
    -   Branch: `impr/fungible-purchase-ux`
    -   Base: `8ee7415a08b408a8b8468f85b8ca5d01a0fc2eb1`
        (`origin/mosaic-fungible`)
-   **HyperBEAM partial fills:**
    `/Users/sam/.codex/worktrees/hb-partial-order-fills-20260804`
    -   Branch: `feat/partial-order-fills`
    -   Current base: `898e56d514f6eb866d7d04561a2ab936a0e5115c`
    -   A separate reviewer is expected to add a commit above this base; integrate
        it without touching their worktree or process.

### Mission — verbatim

Thanks. Please now run the patch on a local HyperBEAM port and use it during testing of the UI+UX.

Please now rework the UI cleanly so that it will allow us a clear, elegant experience for buying fungible tokens. Do this in unattended mode, iterating on your design to make it cleaner and less surprising through multiple revisions. Commander's intent: A well-tested, beautiful, clean experience for fungible token purchases as part of Bazar 2.0. Do not keep things just because they exist right now in the fungible flow. Instead, think through each UI element from first principles and replace/upgrade/improve whichever elements you can to make the experience world-class.

Look out for a new commit on top of `898e56d514f6eb866d7d04561a2ab936a0e5115c` at some point, which will be another agent finishing and shipping their review and tweaks of the patch. Integrate and test on top of this in your own worktree when it lands.

### Current execution state

-   The Bazar branch starts from the latest integrated mosaic/fungible build,
    rather than the superseded chronological UX campaign. It was fast-forwarded
    to current upstream `25e226241bd2acee86c7bc15a271f14aafd34fa3`
    before this feature work began.
-   The initial UI still matches only exact combinations of complete listings
    and explicitly says listings cannot be partially filled. This is the primary
    product behavior being replaced.
-   The validated device contract accepts an optional `fill-quantity`, reserves
    that slice under the original order id, and leaves a proportionally priced
    remainder open under the registration transaction id.
-   Reviewer commit `ced012485704e71c786e203996be1fd657f84962` is integrated
    above `898e56d514f6eb866d7d04561a2ab936a0e5115c`. It independently
    ceiling-scales the remainder's asking, fee, and deposit so repeated splits
    cannot round away a seller's terms. The packaged `arweave-swap@1.0` device
    run passes all 35 tests, including partial settlement and split-term
    conservation.
-   The exact patched branch is running as an isolated HyperBEAM node on port
    `10986` from `/tmp/bazar-partial-hb-config.json`. Its trusted-device map pins
    the published token, reference, security, and process-outbox implementations.
    A cold live computation of the WEAVE process reached slot 283 and returns
    the three open 2, 3, and 5 WEAVE price tiers.
-   Bazar is running on port `3004` and points at that local node through
    `?node=http://127.0.0.1:10986`. Browser-visible verification names
    `127.0.0.1:10986` as the live provider.
-   The exact-combination matcher and manual lot-selection escape hatch are
    removed. Buyers enter the number of tokens they want; Bazar consumes the
    cheapest orders first and partially fills only the last order when needed.
    One WEAVE now quotes a 1-of-2 partial fill, four WEAVE route across the full
    2-unit tier plus 2 of the 3-unit tier, and Max routes all ten units across all
    three listings.
-   Partial fills flow through the complete transaction contract: the original
    order remains the registration target, `fill-quantity` is signed into the
    reservation, asking/minimum fee/deposit use the device's exact ceiling
    formula, and recovery retains both source order and fill quantity.
-   The checkout was iterated from screenshots. It now starts without a false
    validation error, keeps the approval explanation and primary action visible
    at 1280x720, scrolls details independently, shows an itemized max total,
    average execution price, post-purchase balance, compact copyable seller
    identities, and collapses multi-order routes behind an explicit affordance.
    A 390x844 layout has no horizontal overflow and keeps its 44px primary action
    fully visible.
-   Browser testing caught and fixed a partial-fill-specific stale quote: changing
    from one to two units of the same source order previously preserved the same
    React dependency key. The quote identity now includes quantity, asking,
    minimum fee, and recipient; live browser totals changed from
    `0.00008328288 AR` to `0.00013428288 AR` as expected.
-   Final application gates pass: 34 Vitest files / 385 tests, TypeScript,
    production Vite build (1,914 modules), and `git diff --check`.
-   Visual evidence is under
    `.run-data/screenshots/fungible-purchase-ux/`, notably
    `10-empty-no-error.png` and `12-final-candidate-local-hb.png`.
