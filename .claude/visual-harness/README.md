# Bazar visual-regression harness

Proves that moving ~11,800 lines of global CSS out of `src/apps/bazar/styles.css` into per-component
styled-components `styles.ts` files does not change what the app renders.

It compares two builds by capturing, per scenario, a full-page screenshot plus a JSON snapshot of
every rendered element (stable DOM key, bounding box, full `getComputedStyle`, `::before`/`::after`,
own text), then diffing presence, boxes, computed styles, text and pixels.

The app talks to live Arweave gateways and AO peers that rate-limit aggressively (HTTP 429), so the
network is recorded once and replayed for every later capture. Both sides therefore see byte-identical
data and the only thing that can differ is the CSS.

## Where things live

```
run.sh                      entry point
README.md
scripts/
  lib/env.mjs               paths, Playwright + Chromium locations, fixed clock/locale
  lib/server.mjs            static server for a dist, plus a plain file server for the comparer
  lib/netcache.mjs          record/replay of all non-app traffic (method + URL + normalized body)
  lib/browser.mjs           launch flags, determinism (seeded RNG, fixed clock, reduced motion,
                            blocked service workers), animation parking, settle
  lib/drive.mjs             load a scenario, run its steps, wait for a stable frame
  lib/snapshot.mjs          the in-page DOM + computed-style collector, and its expander
  lib/scenarios.mjs         the scenario list, built from ids.json
  build-ref via run.sh      detached git worktree + symlinked node_modules + `npx vite build`
  discover.mjs              harvests real collection/asset/profile ids -> ids.json
  capture.mjs               capture every scenario against one build
  compare.mjs               diff two captures -> Markdown + JSON + pixel-diff PNGs
  inspect.mjs               ad-hoc: print what a route renders (used when picking ids/selectors)
  probe.mjs / probe2.mjs    ad-hoc: dump raw network shapes / console errors
  snaptest.mjs              ad-hoc: sanity-check the snapshot collector on one route
mirror.sh                   copy the source (not the artefacts) into .claude/visual-harness
DATA_DIR                    only in the mirrored copy: where that copy writes its artefacts

ids.json                    discovered ids the scenario list is built from
refs/<name>/dist            a built reference
refs/<name>/COMMIT          the commit it was built from
recordings/<scenario>.json  the recorded network for one scenario
captures/<name>/            manifest.json + <scenario>/{screenshot.png,elements.json,meta.json}
reports/<a>__<b>/           report.md, report.json, diffs/<scenario>.png
build/                      scratch git worktrees (removed after each build)
```

**The scripts are mirrored into `/Users/nickj/arc/repos/bazar/.claude/visual-harness/`** so they
survive a scratchpad wipe. Re-mirror with `./mirror.sh` after any change. That copy contains
`run.sh`, `mirror.sh`, `README.md`, `scripts/` and a `DATA_DIR` file only — never recordings,
captures, refs or builds. `DATA_DIR` points `VR_DATA` at the scratchpad, so running the mirrored
copy from the repo still writes every artefact outside the working tree.

> **`.claude/` is NOT gitignored in this repository.** `.gitignore` covers `node_modules`, `dist`,
> `cache`, `logs` and similar, but nothing under `.claude`; `git status` reports the whole tree as a
> single untracked `?? .claude/`. So `.claude/visual-harness/` — and `.claude/worktrees/` — will show
> up as untracked rather than ignored. Do not commit them. If they should be ignored, that is a
> separate change to `.gitignore` that this harness deliberately does not make.

## Usage

```bash
cd <harness root>

# 1. Build + record the reference. Slow: it is the only pass that touches the network.
#    It runs two passes: one that records (kept as styles-base-recording) and one that replays
#    those recordings to produce the real baseline `styles-base`, so the baseline and every later
#    capture are taken under identical timing.
./run.sh record styles-base adb7111a

# 2. Capture any other build by replaying the same recordings.
./run.sh capture styles-base after-refactor          # a ref name under refs/
./run.sh capture /path/to/dist  after-refactor       # or a dist directory directly

# 3. Compare.
./run.sh compare styles-base after-refactor

# 4. Calibrate: capture the reference build a second time and compare it with itself.
#    The gate is only meaningful while this is clean.
./run.sh calibrate styles-base

# helpers
./run.sh build    my-ref <commit>      # just build a dist from a commit
./run.sh discover styles-base          # just refresh ids.json
./run.sh topup    styles-base          # record only what a replay is missing, until it needs nothing
./run.sh scenarios                     # list scenario names, routes and viewports
./run.sh capture styles-base probe --only asset-fungible   # subset by substring
```

### Why `topup` exists

The app batches GraphQL ids by what has arrived so far. A recording pass crawls (the gateways
rate-limit it) while a replay pass is instant, so the two form _different_ batches and therefore
different request bodies — a replay straight after a record reported 6 unmatched POSTs to
`https://arweave.net/graphql`. `--topup` records whatever is missing **while driving the page with
replay timing**, so it fills exactly the gaps a replay hits. `record` runs record → topup → replay,
and `topup` repeats until a round records nothing new.

`compare` exits 0 when clean and 1 when anything differs, so it can gate a merge.

### Typical runtime

| pass               | what it does                                         | time                            |
| ------------------ | ---------------------------------------------------- | ------------------------------- |
| `build`            | `npx vite build` with warm `node_modules` (no `tsc`) | ~3 s                            |
| `discover`         | 6 page loads against the live network                | 2–10 min (rate-limit dependent) |
| `record`           | build + discover + record every scenario             | 25–60 min, network dependent    |
| `capture` (replay) | every scenario from local recordings                 | ~8–12 min                       |
| `compare`          | snapshot diff + in-browser pixel diff                | ~1–2 min                        |

Only `record`/`discover` touch the network. Re-recording is cheap for scenarios whose requests are
already in the pool: every existing recording is loaded into one shared pool first, so a response is
fetched at most once no matter how many scenarios need it.

## How determinism is achieved

-   **Network** — every non-app-origin request is served from `recordings/<scenario>.json`, keyed on
    `method + URL + sha256(normalized body)`. Bodies are normalized by recursively sorting JSON keys
    and sorting all-string arrays, so GraphQL variable and id ordering cannot change the key.
    Requests to the app origin (the local static server holding the dist under test) always pass
    through and are never taken from a recording. On replay an unmatched request is aborted and
    counted; `capture` prints the per-scenario total, which must be 0.
    Recording never leaves a hole: a request that stays rate-limited records its last real response
    (a genuine 429 is data and replays identically, counted as `degraded`), and only a request that
    produced no response at all becomes a synthesized abort entry (counted as `synthesized`). Both
    counts appear per scenario in `captures/<name>/<scenario>/meta.json`.
    `routeFromHAR` is deliberately not used: HAR matching keys on URL alone, which collapses the many
    distinct `POST https://arweave.net/graphql` bodies onto a single entry.
-   **Peer races** — the app races two AO peers and takes whichever answers first. Replaying from a
    local cache would make that a coin flip, so each host is answered at a fixed delay
    (`REPLAY_DELAY_MS` in `netcache.mjs`) and the same peer always wins.
-   **Telemetry** — `stats.forward.computer` is aborted in both record and replay. Its URLs carry a
    per-visit uuid and a duration that could never match.
-   **Clock** — `page.clock.setFixedTime(...)` (`FIXED_TIME` in `scripts/lib/env.mjs`, currently
    `2026-09-24T20:00:00Z`): `Date.now()`/`new Date()` are frozen so relative timestamps are stable,
    while real timers keep running so the app's own deadlines still resolve. The value must sit just
    _after_ the moment the recordings were taken — a clock set before the recorded block timestamps
    makes the app clamp every relative time to "1 second ago", which is deterministic but exercises
    almost none of the timestamp UI. Change it only together with a re-record.
-   **Randomness** — `Math.random`, `crypto.randomUUID` and `crypto.getRandomValues` are replaced by a
    seeded generator in an init script that runs before any app code.
-   **Environment** — locale `en-US`, timezone `UTC`, `reducedMotion: 'reduce'`, `forcedColors: none`,
    `deviceScaleFactor: 1`, service workers blocked by the context _and_ 404'd by the static server.
-   **Animation** — every `document.getAnimations()` entry is set to `currentTime = 0` and paused
    before the snapshot and again before the screenshot, and the screenshot uses Playwright's
    `animations: 'disabled'` and `caret: 'hide'`. Animations are _not_ neutralised with injected CSS,
    which would corrupt the computed styles being compared.
-   **Rendering** — pinned Chromium (`chromium-1194` from the Playwright browser cache, never
    downloaded), `--force-color-profile=srgb`, hinting and subpixel positioning off, scrollbars hidden.
-   **Settling** — network idle, then any present `.loading` / `.asset-detail-loading-shell` /
    `.layout-placeholder` waits for detach, then `document.fonts.ready`, a settle delay, a second
    idle check, animation parking and `scrollTo(0, 0)`.

## The element snapshot

For every element in document order (skipping `head`, `script`, `style`, `link`, `template`,
`noscript`) the snapshot stores:

-   **a stable key** — the DOM path of `tag:nth-of-type` plus the element's _stable_ classes.
    A class counts as styled-components-generated, and is left out of the key, when it starts with
    `sc-`, or when it appears only in a `style[data-styled]` sheet and is a mixed-case hash of 4–12
    characters. Authored names (hyphenated, or also present in a plain stylesheet) stay in the key, so
    the key survives CSS moving from a global stylesheet into `createGlobalStyle`.
    The detected generated-class set is recorded in each snapshot's `meta` so drift is visible.
-   **its bounding box** in document coordinates, rounded to 0.01 px,
-   **its full `getComputedStyle` map**, plus `::before`/`::after` when their `content` is not `none`,
-   **its own text** (direct text children only, whitespace collapsed).

The property column list is the **union** of the names `getComputedStyle` enumerates across every
element and rendered pseudo — not just `:root`. `getComputedStyle` only lists the custom properties
_declared on the element it is called with_, so probing only the document element hid five
component-scoped variables (`--asset-grid-gap`, `--token-avatar-size`, `--tab-inset`,
`--name-artwork-size`, `--ui-tooltip-delay`).

Values are normalized before storage: the app origin becomes `APP`, hashed build assets become
`/assets/<name>-<hash>.<ext>`, `blob:` URLs are numbered, and every `@keyframes` name — global or
styled-components-generated — becomes `<kf:HASH>` where the hash is taken over the keyframe's
**body**. Hashing the body rather than erasing the name matters: this refactor renames global
keyframes (`home-enter`) into generated ones, so comparing names would flag every animation as
changed, while erasing them would hide an animation that genuinely changed. Identical bodies
collapse to the same token (`spin` and `udl-credit-badge-spin` both hash to `<kf:10gm6la>`).

The file is interned — a shared property list, a string table and deduplicated style vectors —
because a raw dump of every computed property for every element is roughly 100x larger.

## The report

`reports/<a>__<b>/report.md` has a per-scenario table (element counts, missing, added, box, style and
text differences, changed pixels and percentage, unmatched network requests) followed by collapsed
sections. Identical differences are grouped across elements _and_ scenarios, so a single token change
that touches 4,000 elements reads as one line with a count and a sample key rather than 4,000 lines.
`report.json` holds the full ungrouped detail, and `diffs/<scenario>.png` marks changed pixels in
magenta over a dimmed copy of the page.

Thresholds: boxes differ above 0.5 px (`--box-epsilon`), pixels above a per-channel delta of 2
(`--pixel-tolerance`); computed styles and text are compared exactly.

Pixel diffing runs inside Chromium on a canvas, because no image library is installed and none may
be installed.

## Choosing scenario ids

`discover.mjs` loads the built app and scrapes real ids from the rendered links, writing `ids.json`.
Two ids are worth understanding:

-   `uniqueAsset` — the first discovered asset outside the `fungible-tokens` pseudo-collection.
-   `fungibleAsset` — the first discovered asset _inside_ it. Do **not** use the `FUNGIBLE_TOKEN_ID`
    constant from `src/api/collections/adapter.ts` as a scenario id: against live data it renders the
    "Asset not found" route state (an `error-panel` in a `route-state-shell`, ~99 elements), so the
    fungible view, its tabs and the lazy price chart never mount and the scenario silently tests
    nothing. It is kept only as a last-resort fallback.

After changing an id, delete that scenario's recording and re-run `capture … --record --only <name>`;
the recording is keyed by scenario name, so a stale one would replay the old route's traffic.

Always sanity-check a new scenario by reading back a few strings from its `elements.json` rather than
trusting that the capture succeeded — a page that renders an error state still captures cleanly.

## Constraints this harness respects

-   Never runs `npm install`; reference builds symlink the integration worktree's `node_modules`.
-   Never downloads a browser; it uses the already-cached `chromium-1194`.
-   Skips `tsc` when building a reference (`npx vite build` only).
-   Removes its temporary git worktree after every build.
-   Writes nothing into the repository working tree except the mirrored scripts under
    `.claude/visual-harness/`.
-   Injects only a read-only fake `window.arweaveWallet`; `sign`, `signDataItem` and `dispatch` throw,
    so no scenario can ever submit anything.
