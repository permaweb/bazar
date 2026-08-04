import type { ObserverView } from 'weave-wrangler';

type ConfirmationStep = {
  confirmations?: number;
  transaction?: {
    consensus?: { confirmations: number };
    views?: ObserverView[];
  };
};

export function quorumConfirmationDepth(step?: ConfirmationStep): number {
  const confirmations = step?.confirmations ?? step?.transaction?.consensus?.confirmations ?? 0;
  return Number.isSafeInteger(confirmations) && confirmations > 0 ? confirmations : 0;
}
