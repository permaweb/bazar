# Token swap composition

## Prompt

Bazar 2.0 must trade one-unit `token@1.0` process assets scheduled by
`arweave-scheduler@1.0` in `all` mode and settled by
`arweave-swap@1.0`, changing existing devices only precisely minimally.

## Issue

`arweave-swap@1.0` already implements the complete offer, escrow,
reservation, cancellation, and native AR payment protocol against a process's
`balances`. The standalone `token@1.0` implementation does not currently:

1. construct a `balances` submessage from the scalar `initial-holder` carried
   by an Arweave process transaction; or
2. offer every all-mode scheduled assignment to a scalar `swap-device`.

An all-mode process also sees unrelated Arweave transactions. Passing those
through token's normal action router would create spurious error notices, while
passing swap control actions through both devices would do the same after the
swap had already handled them.

## Options

1. Add another stack/container device or modify `process@1.0`.
   This changes the kernel and does not solve the fact that nested device
   configuration cannot survive a flat Arweave transaction.
2. Copy swap behavior into token.
   This duplicates a security-sensitive protocol and creates two sources of
   truth.
3. Reproduce carrier's scalar composition pattern in token.
   Seed balances once, delegate every assignment to the configured swap device,
   route only transactions addressed to the token through token semantics, and
   let the swap device exclusively consume its three control actions.

## Decision

Choose option 3. Change only standalone `token@1.0`:

-   seed `initial-holder` with `total-supply` when `balances` is absent;
-   preserve exact, case-sensitive Arweave address keys for swap-configured
    ledgers (the swap settles against exact L1 signer addresses), while leaving
    the existing canonical key behavior unchanged for ordinary token ledgers;
-   call configured `swap-device` before token routing and restore
    `device: token@1.0`;
-   ignore unrelated all-mode traffic;
-   do not run `make-offer`, `cancel-order`, or `register-interest` through the
    token action router after the swap has handled them;
-   retain the existing behavior for token processes without `swap-device`.

Pin the token repository's HyperBEAM dependency and forge plugin to the exact
`feat/name-token` commit required by the mission so the composed device and its
tests use the same runtime. Do not edit HyperBEAM.

Validation must cover initialization, idempotent seeding, unrelated traffic,
offer/cancel, reservation, native payment settlement, direct transfer, and
device restoration.
