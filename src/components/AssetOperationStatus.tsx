import { AlertCircle, ChevronRight, LoaderCircle } from 'lucide-react';
import React from 'react';

import { Button } from './Button';

export type AssetOperationKind = 'sell' | 'buy' | 'cancel' | 'transfer';
export type AssetOperationPhase = 'form' | 'approval' | 'working' | 'done' | 'error';

export function assetOperationProgressTitle(kind: AssetOperationKind, phase: AssetOperationPhase) {
  const subject = {
    sell: 'Listing',
    buy: 'Purchase',
    cancel: 'Listing cancellation',
    transfer: 'Transfer',
  }[kind];
  return phase === 'error' ? `${subject} needs attention` : `${subject} in progress`;
}

export function assetOperationPendingActionLabel(kind: AssetOperationKind) {
  return {
    sell: 'Listing…',
    buy: 'Buying…',
    cancel: 'Canceling listing…',
    transfer: 'Transferring…',
  }[kind];
}

type Props = {
  kind: AssetOperationKind;
  phase: AssetOperationPhase;
  status: string;
  onView(): void;
};

export function AssetOperationStatus({ kind, phase, status, onView }: Props) {
  const failed = phase === 'error';
  return (
    <div className={`asset-operation-status ${phase}`}>
      <span className="asset-operation-status-icon" aria-hidden="true">
        {failed ? <AlertCircle className="ui-icon" /> : <LoaderCircle className="ui-icon operation-activity-loader" />}
      </span>
      <span className="asset-operation-status-copy" aria-atomic="true" aria-live="polite" role="status">
        <strong>{assetOperationProgressTitle(kind, phase)}</strong>
        <small>{status}</small>
      </span>
      <Button className="with-icon" onClick={onView}>
        View details <ChevronRight className="ui-icon ui-icon--sm" aria-hidden="true" />
      </Button>
    </div>
  );
}
