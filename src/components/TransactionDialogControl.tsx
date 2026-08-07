import React from 'react';
import { Eye, EyeOff, X } from 'lucide-react';

import { Button } from './Button';

export type TransactionDialogPhase = 'form' | 'approval' | 'working' | 'done' | 'error';

export type TransactionDialogDismissAction =
  { kind: 'hide' } | { kind: 'close'; refresh: boolean; resumeLater: boolean };

export const TRANSACTION_DIALOG_HIDE_DURATION_MS = 480;

export function isTransactionActivityVisible(phase: TransactionDialogPhase) {
  return phase !== 'approval' && phase !== 'done';
}

type DialogMotionRect = Pick<DOMRect, 'height' | 'left' | 'top' | 'width'>;

export function transactionDialogHideMotion(source: DialogMotionRect, target: DialogMotionRect) {
  const sourceCenterX = source.left + source.width / 2;
  const sourceCenterY = source.top + source.height / 2;
  const targetCenterX = target.left + target.width / 2;
  const targetCenterY = target.top + target.height / 2;
  const scale = Math.max(0.035, Math.min(0.12, target.width / source.width, target.height / source.height));
  return {
    x: targetCenterX - sourceCenterX,
    y: targetCenterY - sourceCenterY,
    scale,
  };
}

export function transactionDialogHideTarget(target: DialogMotionRect, viewport: { height: number; width: number }) {
  const edge = 12;
  const fullyAbove = target.top + target.height <= 0;
  const fullyBelow = target.top >= viewport.height;
  return {
    ...target,
    left: Math.min(Math.max(edge, target.left), Math.max(edge, viewport.width - target.width - edge)),
    top: fullyAbove ? edge : fullyBelow ? Math.max(edge, viewport.height - target.height - edge) : target.top,
  };
}

export function prepareTransactionDialogHide(dialog: HTMLElement, target?: HTMLElement | null) {
  const measured = target?.getBoundingClientRect();
  const destination = measured
    ? transactionDialogHideTarget(measured, { height: window.innerHeight, width: window.innerWidth })
    : {
        left: window.innerWidth - 54,
        top: 18,
        width: 36,
        height: 36,
      };
  const motion = transactionDialogHideMotion(dialog.getBoundingClientRect(), destination);
  dialog.style.setProperty('--dialog-hide-x', `${motion.x}px`);
  dialog.style.setProperty('--dialog-hide-y', `${motion.y}px`);
  dialog.style.setProperty('--dialog-hide-scale', `${motion.scale}`);
}

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
    <Button
      aria-label={working ? 'Hide transaction details' : 'Close dialog'}
      className={`close${working ? ' transaction-hide' : ''}`}
      onClick={onClick}
      size="icon"
      title={working ? 'Hide transaction details' : 'Close'}
      variant="ghost"
    >
      {working ? (
        <span className={`transaction-hide-icon${hiding ? ' hiding' : ''}`} aria-hidden="true">
          <Eye className="ui-icon transaction-hide-eye-open" />
          <EyeOff className="ui-icon transaction-hide-eye-closed" />
        </span>
      ) : (
        <X className="ui-icon" aria-hidden="true" />
      )}
    </Button>
  );
}
