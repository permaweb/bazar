import { SwapPurchase as WeaveWranglerSwapPurchase } from 'weave-wrangler';

// The purchase state machine is constructed by fungible batch settlement; keep the SDK import here.
export const SwapPurchase = WeaveWranglerSwapPurchase;
export type SwapPurchase = WeaveWranglerSwapPurchase;
