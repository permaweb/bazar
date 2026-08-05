import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { TransactionDialogControl, transactionDialogDismissAction } from './TransactionDialogControl';

describe('shared transaction dialog control', () => {
  it('hides working transactions without closing their lifecycle', () => {
    expect(transactionDialogDismissAction('working', true)).toEqual({ kind: 'hide' });
    const markup = renderToStaticMarkup(
      React.createElement(TransactionDialogControl, {
        phase: 'working',
        onClick: () => undefined,
      }),
    );
    expect(markup).toContain('aria-label="Hide transaction details"');
    expect(markup).toContain('transaction-hide-eye-open');
    expect(markup).toContain('transaction-hide-eye-closed');
  });

  it('uses the normal close control outside active progress', () => {
    expect(transactionDialogDismissAction('form', false)).toEqual({
      kind: 'close',
      refresh: false,
      resumeLater: false,
    });
    expect(transactionDialogDismissAction('error', true)).toEqual({
      kind: 'close',
      refresh: true,
      resumeLater: true,
    });
    const markup = renderToStaticMarkup(
      React.createElement(TransactionDialogControl, {
        phase: 'done',
        onClick: () => undefined,
      }),
    );
    expect(markup).toContain('aria-label="Close dialog"');
    expect(markup).not.toContain('transaction-hide-eye-open');
  });
});
