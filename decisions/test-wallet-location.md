# Test wallet location

## Prompt

Use `~/src/Documents/hyperbeam-key.json` for the AR needed by end-to-end
testing, with a hard ceiling of 50 AR.

## Issue

That path does not exist. The nearest canonical key,
`~/src/hyperbeam-key.json`, exists but its on-chain balance is zero. The
development-scoped `~/src/playground/hyperbeam-key.json` has
396.224817431186 AR.

## Decision

Use the funded playground development wallet, retain the 50 AR ceiling, and
record its starting/ending balance plus every transaction ID. This is more
consistent with the requested real-network end-to-end test than silently
substituting mocks or stopping an explicitly unattended mission. No other
wallet is touched.
