import type { ObserverView } from 'weave-wrangler';

type ConfirmationStep = {
  confirmations?: number;
  transaction?: {
    consensus?: { confirmations: number; answering?: number; eligible?: number };
    views?: ObserverView[];
  };
};

export function quorumConfirmationDepth(step?: ConfirmationStep): number {
  const confirmations = step?.confirmations ?? step?.transaction?.consensus?.confirmations ?? 0;
  return Number.isSafeInteger(confirmations) && confirmations > 0 ? confirmations : 0;
}

export function observerVerificationDelayed(step?: ConfirmationStep): boolean {
  const consensus = step?.transaction?.consensus;
  const views = step?.transaction?.views ?? [];
  if (!consensus || quorumConfirmationDepth(step) > 0) return false;
  if (consensus.answering !== 0 || consensus.eligible !== 0) return false;

  return views.some((view) => view.lastSeenAt !== undefined || view.httpStatus !== undefined || Boolean(view.error));
}
