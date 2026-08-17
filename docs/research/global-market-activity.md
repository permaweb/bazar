# Global market activity: complete, performant, and truthful pagination

Research date: 2026-08-17

## Recommendation

Do not increase the in-memory limit or present the gateway's current raw `count` as the marketplace total. Replace the current generic action scan with a versioned Bazar activity stream:

1. Add one immutable, query-specific tag to every newly signed market action, for example `data-protocol=bazar-market@1.0`.
2. Query that tag with cursor pagination and keep a separate cursor for **All**, **Listings**, **Confirmed purchases**, **Transfers**, and **Cancellations**.
3. Keep collection-membership and process-support checks. The protocol tag is an efficient index selector, not proof that the target belongs in the marketplace.
4. Count and display loaded, accepted events. Treat any gateway `count` as an optional count of raw tagged submissions, never as the number of accepted marketplace events or compute-confirmed purchases.
5. Refresh incrementally from the head to a known transaction watermark, cache pages and cursors by gateway/query/scope, and fetch older pages only when the user asks.
6. Put pre-marker history behind an explicitly labelled, lazy legacy scan scoped by known asset recipients and an activation block height. Never page backward through the global generic `transfer` stream.

This makes the feed browseable beyond 100 without downloading all history, while keeping every number tied to what the application actually knows.

## What the current implementation does

The activity GraphQL query asks for `action` values only, orders by `HEIGHT_DESC`, requests 100 raw transactions per page, and returns only `hasNextPage` plus edge cursors. It accepts an optional recipients list but the Home activity request does not supply one. See [`MARKET_ACTIVITY_QUERY`](../../src/api/asset-discovery.ts#L345-L363).

`discoverCollectionActivity` scans raw pages until it has accepted its requested limit, which is capped at 200. It validates event shape, can restrict process IDs, and can verify process devices, but it returns only an event array: the last cursor and raw `hasNextPage` are discarded. See [`discoverCollectionActivity`](../../src/api/asset-discovery.ts#L1059-L1147).

Home currently requests up to 200 raw events, checks known collection membership, resolves supported unknown targets, compute-verifies purchase registrations, and then retains the newest 100 accepted events. See [`HomeActivityPanel`](../../src/app/App.tsx#L4634-L4799) and [`newestCollectionActivity`](../../src/app/App.tsx#L5401-L5415). The browser cache also slices each scope to 100 events and stores neither a cursor nor `hasMore`. See [`market-activity-storage.ts`](../../src/app/market-activity-storage.ts#L7-L30).

The important distinction is:

```text
gateway raw action matches
  -> syntactically valid activity events
  -> known or supported marketplace process
  -> compute-confirmed purchase, when applicable
  -> visible activity event
```

GraphQL can count only the first line. The UI currently shows the last line.

## Live gateway evidence

Read-only checks were run against the configured production route, [`https://bazar.arweave.net/graphql`](https://bazar.arweave.net/graphql), on 2026-08-17. These are observations of that indexed gateway at that time, not protocol-wide constants.

| Query                                     | Indexed raw count |                          Elapsed |
| ----------------------------------------- | ----------------: | -------------------------------: |
| `action` in all four current values       |        17,778,683 |                           0.48 s |
| `action=make-offer`                       |               247 | included in 0.73 s aliased query |
| `action=register-interest`                |               268 | included in 0.73 s aliased query |
| `action=transfer`                         |        17,778,120 | included in 0.73 s aliased query |
| `action=cancel-order`                     |                48 | included in 0.73 s aliased query |
| proposed `data-protocol=bazar-market@1.0` |                 0 |                  same live check |

Generic transfers were 99.996833% of the combined raw action matches. Therefore the current unscoped combined query is overwhelmingly a scan of unrelated transactions. Raising its 200-raw-event limit would spend more gateway, verification, and compute work without defining a complete Bazar feed.

The five newest `make-offer` rows had the expected order fields and sometimes Wander signing-client tags, but no Bazar or market-protocol discriminator. The write path confirms that current actions add action-specific fields only; it does not add an application/protocol marker. See [`AssetTransactionClient.makeOffer`, cancellation, and transfer](../../src/api/asset-transactions.ts#L239-L320), [purchase registration](../../src/api/asset-transactions.ts#L580-L599), and [`processInteractionTags`](../../src/api/asset-transactions.ts#L1678-L1688).

The selected gateway exposes `TransactionConnection.count` as a string on an initial query. Combining `count` with `after` failed with HTTP 400 and `request does not support [search_after]`; the same cursor request succeeded when `count` was omitted. Consequently, even where `count` is supported, request it only on the first page.

The live counts above can be reproduced, subject to later index growth, with this read-only query at the linked endpoint:

```graphql
query ActivityCounts {
	all: transactions(
		first: 1
		tags: [{ name: "action", values: ["make-offer", "register-interest", "transfer", "cancel-order"] }]
	) {
		count
	}
	listings: transactions(first: 1, tags: [{ name: "action", values: ["make-offer"] }]) {
		count
	}
	registrations: transactions(first: 1, tags: [{ name: "action", values: ["register-interest"] }]) {
		count
	}
	transfers: transactions(first: 1, tags: [{ name: "action", values: ["transfer"] }]) {
		count
	}
	cancellations: transactions(first: 1, tags: [{ name: "action", values: ["cancel-order"] }]) {
		count
	}
	proposed: transactions(first: 1, tags: [{ name: "data-protocol", values: ["bazar-market@1.0"] }]) {
		count
	}
}
```

To reproduce the cursor incompatibility, first request edges and `count`, then pass the final edge cursor as `after` while still selecting `count`. Removing only `count` from the cursor query allows the page to load.

That raw count is not the answer the UI needs:

-   The combined action count includes unrelated protocols, as the transfer result demonstrates.
-   A future marker count would count tagged submissions, including malformed, unsupported, out-of-scope, or deliberately spoofed submissions filtered out by Bazar.
-   `register-interest` counts registrations, while the UI includes only registrations with a compute-derived purchase proof. `confirmPurchaseActivity` reads current process state and schedule windows to establish that proof; GraphQL does not expose it as a searchable field. See [`confirmPurchaseActivity`](../../src/api/asset-discovery.ts#L89-L125) and the global filter's proof requirement in [`filterGlobalActivity`](../../src/app/App.tsx#L4548-L4554).

## What Arweave GraphQL guarantees

The official ar.io guide says provider result limits vary and prescribes cursor pagination: read `pageInfo.hasNextPage`, take the last edge's `cursor`, and supply it as `after` for the next page. It also recommends precise tags, query-oriented schemas, and essential fields for performance. [Official pagination and optimization guide](https://docs.ar.io/build/access/find-data#pagination)

The current ar.io-node schema supports transaction filters for IDs, owners, recipients, tags, bundles, and block-height ranges. It documents `HEIGHT_DESC` as newest and pending/unconfirmed first, an edge cursor as the value passed to `after`, and `PageInfo` with only `hasNextPage`. [Pinned ar.io-node GraphQL schema](https://github.com/ar-io/ar-io-node/blob/2b07e4550d87af5b6b4d9bd31630c7563ce7bf4e/src/routes/graphql/schema/types.graphql#L16-L66), [sort and tag-filter semantics](https://github.com/ar-io/ar-io-node/blob/2b07e4550d87af5b6b4d9bd31630c7563ce7bf4e/src/routes/graphql/schema/types.graphql#L96-L151), [connection and cursor types](https://github.com/ar-io/ar-io-node/blob/2b07e4550d87af5b6b4d9bd31630c7563ce7bf4e/src/routes/graphql/schema/types.graphql#L178-L208)

The reference ar.io-node connection has no `count` field, while the selected search gateway currently does. `count` is therefore a provider capability, not a portable dependency for the feed. The selected gateway's own schema must be feature-detected if the application chooses to use it.

`hasNextPage` means that the raw GraphQL predicate has another row. The reference gateway calculates it by looking for more than the requested page size before slicing the returned edges. It says nothing about whether a later row will pass Bazar's membership or compute checks. [Pinned ar.io-node implementation](https://github.com/ar-io/ar-io-node/blob/2b07e4550d87af5b6b4d9bd31630c7563ce7bf4e/src/database/standalone-sqlite.ts#L2733-L2744)

Finally, “global” must remain index-qualified. Official ar.io documentation says ar.io gateways return the data they have indexed; provider coverage can differ. [Official GraphQL provider notes](https://docs.ar.io/build/access/find-data#graphql-providers)

## Proposed stream design

### 1. Add a selective, versioned protocol tag

All future `make-offer`, `register-interest`, `transfer`, and `cancel-order` transactions should include exactly one new tag, chosen before rollout because signed Arweave tags are immutable:

```text
data-protocol = bazar-market@1.0
```

The exact spelling is a protocol decision; the important properties are that it is versioned, present on every action kind, and selective enough to be the leading GraphQL predicate. Preserve the existing `action` tag because it is the natural per-stream filter.

A marker is not authorization. Any wallet can copy a tag. Bazar must still require either exact membership in a visible collection or successful resolution as a supported marketplace process before publishing an event. Optional redundant tags such as a collection hint may improve query routing later, but they must not replace canonical membership checks.

### 2. Give every filter an independent server-side stream

Maintain five query states rather than filtering one 100-event array:

| UI filter           | GraphQL predicate                     | Post-query work                                             |
| ------------------- | ------------------------------------- | ----------------------------------------------------------- |
| All                 | protocol marker + four action values  | membership/support checks; purchase proof for registrations |
| Listings            | protocol marker + `make-offer`        | membership/support checks                                   |
| Confirmed purchases | protocol marker + `register-interest` | membership/support checks plus compute proof                |
| Transfers           | protocol marker + `transfer`          | membership/support checks                                   |
| Cancellations       | protocol marker + `cancel-order`      | membership/support checks                                   |

This prevents a high-volume action kind from crowding another kind out of the recent window. Switching to Listings should fetch listing pages, not merely filter whichever actions happened to fit in All.

Each stream state should retain at least:

```ts
type ActivityStreamState = {
	events: CollectionActivityEvent[];
	after: string | null; // last raw edge fully consumed
	rawHasNextPage: boolean;
	exhausted: boolean; // raw end reached and verification settled
	newestWatermark?: string; // known transaction ID for head refresh
	gateway: string;
	queryVersion: string;
	scope: string;
	refreshedAt: number;
};
```

Fetch raw pages of up to 100, but stop only after one of these conditions:

-   enough **accepted** events exist for the next visible batch;
-   the gateway reports no next raw page;
-   a request/time/page safety budget is reached, in which case expose a retry/continue state rather than an end-of-history claim.

If the accepted-event target is reached in the middle of a raw page, retain the cursor of the last raw edge actually consumed, or retain the unconsumed page remainder. Advancing to the page's final cursor would silently skip events.

### 3. Keep membership filters out of the hot global query

Recipient filters are exact and useful for one asset or a small collection. They are not a good primary global plan when the marketplace contains thousands of process IDs: batching a large recipients set creates many queries and must be repeated as membership changes.

For the new stream, use the protocol marker for selectivity and perform the existing O(1) known-membership lookup locally. Resolve and cache an unknown target once, with bounded concurrency, before admitting it. This preserves discovery of newly supported assets without enumerating the entire catalogue in every request.

Recipient-batched queries remain appropriate for the lazy legacy path because old actions lack the marker and the generic global stream is unusably noisy.

### 4. Separate cursor paging from incremental refresh

Older-page loading and head refresh solve different problems:

-   **Load older:** continue from that filter's stored tail cursor.
-   **Refresh:** query from the head and continue until reaching a cached transaction-ID watermark, merging and deduplicating by transaction ID.

Do not assume a stored tail cursor is portable across gateways or query changes. Cache keys should include gateway origin, protocol/query version, filter, and collection scope. If any changes, discard the cursor and refresh from the head.

Pending/unconfirmed rows can appear first under `HEIGHT_DESC`, then move as they become mined. Head refresh plus ID deduplication prevents a cached snapshot from being treated as immutable ordering. A bounded refresh that cannot reach its watermark should say it is partial and allow continuation rather than silently declaring the cache current.

The existing browser store should become a versioned display cache containing events, cursor state, `hasMore`, and timestamps. Render cached events immediately, revalidate in the background, keep only one request chain per filter, abort obsolete chains, and retain the existing request deadlines and bounded support/compute concurrency. Live indexed results remain authoritative.

### 5. Make totals and completion language match the evidence

The default UI does not need a historical total to be complete. It needs a real next-page state.

Recommended copy:

-   While more accepted events are already cached: `Showing 20 of 73 loaded events.`
-   When the tail has more raw indexed pages: `73 events loaded. Older indexed activity is available.`
-   When a safety budget interrupts scanning: `73 events loaded. Continue checking older indexed activity.`
-   Only when the raw stream is exhausted and verification is settled: `End of indexed activity for this filter.`
-   For gateway scope: `Indexed Bazar activity` or `Activity indexed by this gateway`, not an unqualified claim about every submitted transaction.

Filter badges should say `loaded` in accessible help text, or omit numbers until that filter has loaded. `Confirmed purchases` must always count only events with `purchaseProof`, so its number is a loaded-and-verified count.

If a compatible provider exposes `count`, the application may request it on the first page only and label it narrowly, such as `268 indexed tagged registrations`. It must not label that value `Confirmed purchases`, `marketplace total`, or `events in these collections`. Cursor pages must omit `count`. A capability failure should fall back to cursor paging with no total, not fail the activity feed.

## Legacy history

Choose and publish an activation block height for `bazar-market@1.0`.

The main feed should use the marker at and after that height. For continuity, merge already cached, previously verified events around the activation boundary, but do not imply that a 100-event cache is a complete pre-marker archive.

If older history is valuable, expose `Browse legacy activity` as a user-triggered mode. Query one action kind at a time with:

-   `block.max = activationHeight - 1`;
-   recipients batched from the known collection membership;
-   cursor pagination per recipient batch;
-   bounded concurrency and request/page budgets;
-   the same event validation, membership, and purchase-proof logic.

Label its scope: it covers the asset membership known to this client and gateway. Newly discovered or not-yet-loaded membership can make it incomplete.

An exact historical total of every accepted event across all current and past collection membership would require a maintained, replayable projection/index with explicit trust and backfill rules. The current frontend-only architecture should not introduce that system merely to populate badges. Cursor completeness and truthful loaded counts solve the user-facing problem without a new backend.

## Delivery sequence

1. **Protocol write first:** add and test the marker on all four signed action types. Record the activation height after the first indexed writes.
2. **Read model:** return page state (`after`, raw `hasNextPage`, accepted events, partial/exhausted reason) instead of only an array. Ensure subsequent queries omit `count`.
3. **Independent filters:** move each tab to its own query/cursor/cache state and load the first visible batch on demand.
4. **Incremental cache:** add per-gateway/query/scope/filter cache versioning, head watermarks, deduplication, and stale-while-revalidate behavior.
5. **Truthful UI:** replace the 100-window terminal state with load-older/continue/end states backed by the stream state.
6. **Optional legacy mode:** implement recipient-batched, pre-activation queries only if the product needs older history.

Critical regression cases:

-   protocol marker is present on every newly signed action and covered by transaction-intent validation;
-   `count` is requested only on an initial page and unsupported `count` falls back cleanly;
-   the next request uses the last consumed raw edge cursor without skipping a partial page;
-   `hasNextPage=true` never renders as end-of-history after local filtering;
-   each activity filter advances only its own cursor;
-   unrelated generic transfers cannot enter or starve the tagged stream;
-   unknown/spoofed targets are withheld until membership/support succeeds;
-   confirmed-purchase badges exclude unproved registrations;
-   cached cursors are invalidated when gateway, query version, or membership scope changes;
-   head refresh deduplicates IDs and can cross more than one page to reach its watermark;
-   abort, rate-limit, timeout, and verification-budget exits retain already accepted events and expose continuation.

## Decision

The performant definition of “proper global activity” is a cursor-browseable stream of **indexed, Bazar-tagged, membership-accepted events**, with compute verification where the UI claims confirmation. It is not a larger fixed array and it is not the raw GraphQL `count`.

This design can truthfully show all indexed events over time, keep the first render bounded, prevent transfers from starving other filters, and avoid claiming totals that the client has not actually verified.
