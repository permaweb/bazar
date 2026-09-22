import type * as WeaveWrangler from 'weave-wrangler';

// Application-facing names for the transaction runtime's purchase and observation contracts.
// UI layers import these through `api/transactions` so the SDK stays behind the adapter boundary.
export type Consensus = WeaveWrangler.Consensus;
export type Observer = WeaveWrangler.Observer;
export type ObserverView = WeaveWrangler.ObserverView;
export type PreparedTransaction = WeaveWrangler.PreparedTransaction;
export type PurchaseSnapshot = WeaveWrangler.PurchaseSnapshot;
export type PurchaseState = WeaveWrangler.PurchaseState;
export type PurchaseTransaction = WeaveWrangler.PurchaseTransaction;
export type TxWatcher = WeaveWrangler.TxWatcher;
export type WeaveNetwork = WeaveWrangler.WeaveNetwork;
