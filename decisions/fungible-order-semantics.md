# Fungible order semantics

## Prompt

Bazar 2.0 must support the complete fungible-token flow on the existing
`token@1.0` + `arweave-swap@1.0` protocol: arbitrary token quantities,
listing and cancellation, and purchases that match and settle multiple orders
in parallel.

## Issue

`arweave-swap@1.0` already accepts arbitrary `offer-quantity` values and any
number of simultaneous orders, but each order is deliberately an indivisible
lot. Its `asking` value is the total AR price for that entire lot. The protocol
has no partial-fill field and cannot refund an over- or underpayment because AR
moves directly from buyer to seller outside the process.

Changing the device to introduce partial fills would expand the consensus
protocol, alter the meaning of existing orders, and exceed the app-layer scope
without being necessary for the requested multi-order v1.

## Decision

Bazar will expose the protocol honestly as a whole-lot order book:

- sellers choose an arbitrary token quantity and a unit price; Bazar commits
  the exact atomic quantity and the resulting total `asking` price;
- buyers choose one or more complete lots; the UI shows the exact combined
  token quantity, blended unit price, total AR, and each seller before signing;
- automatic quantity matching succeeds only when a deterministic combination
  of whole lots exactly satisfies the requested amount; it never silently
  overbuys;
- each matched order gets its own reservation and native-AR payment; after all
  signatures exist, the independent purchase lifecycles run concurrently;
- the sync overlay exposes one tab per order while all orders continue in the
  background.

This implements every capability the deployed protocol currently promises,
keeps the base devices unchanged, and leaves a future partial-fill protocol as
an explicit versioned device change rather than an implicit UI fiction.
