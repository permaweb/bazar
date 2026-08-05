import React from 'react';
import { Eye, EyeOff, X } from 'lucide-react';

export type TransactionDialogPhase = 'form' | 'approval' | 'working' | 'done' | 'error';

export type TransactionDialogDismissAction =
  | { kind: 'hide' }
  | { kind: 'close'; refresh: boolean; resumeLater: boolean };

export function transactionDialogDismissAction(
  phase: TransactionDialogPhase,
  recoverable: boolean,
): TransactionDialogDismissAction {
  if (phase === 'working') return { kind: 'hide' };
  return {
    kind: 'close',
    refresh: phase !== 'form',
    resumeLater: phase === 'approval' || (phase === 'error' && recoverable),
  };
}

export function TransactionDialogControl({
  hiding = false,
  phase,
  onClick,
}: {
  hiding?: boolean;
  phase: TransactionDialogPhase;
  onClick(): void;
}) {
  const working = phase === 'working';
  return (
    <button
      aria-label={working ? 'Hide transaction details' : 'Close dialog'}
      className={`close${working ? ' transaction-hide' : ''}`}
      onClick={onClick}
      title={working ? 'Hide transaction details' : 'Close'}
      type="button"
    >
      {working ? (
        <span className={`transaction-hide-icon${hiding ? ' hiding' : ''}`} aria-hidden="true">
          <Eye className="ui-icon transaction-hide-eye-open" />
          <EyeOff className="ui-icon transaction-hide-eye-closed" />
        </span>
      ) : (
        <X className="ui-icon" aria-hidden="true" />
      )}
    </button>
  );
}
