import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ThemeProvider } from 'styled-components';
import { theme } from 'helpers/theme';
import {
  createWebGLRendererSafely,
  shouldClearTransactionInspection,
  shouldRenderProofPins,
  TransactionRendererFallback,
  type Infinity3DLane,
} from './TransactionSequenceCable3D';

function fallbackLane(statusLabel: string): Infinity3DLane {
  return {
    observerUrl: 'https://observer.example',
    label: 'Observer one',
    detail: '',
    statusLabel,
    stages: [],
    progress: 0,
    phases: [],
    state: 'pending',
    confirmations: 0,
    error: false,
    markers: [],
  };
}

function renderFallback(statusLabel: string) {
  return renderToStaticMarkup(
    React.createElement(
      ThemeProvider,
      { theme },
      React.createElement(TransactionRendererFallback, { lanes: [fallbackLane(statusLabel)] }),
    ),
  );
}

describe('transaction map renderer fallback', () => {
  it('owns Escape only while an inspection is visible', () => {
    expect(shouldClearTransactionInspection('Escape', true)).toBe(true);
    expect(shouldClearTransactionInspection('Escape', false)).toBe(false);
    expect(shouldClearTransactionInspection('ArrowRight', true)).toBe(false);
  });

  it('turns WebGL initialization failure into an optional visualization fallback', () => {
    expect(
      createWebGLRendererSafely(() => {
        throw new Error('WebGL unavailable');
      }),
    ).toBeNull();
    expect(shouldRenderProofPins(true)).toBe(false);
  });

  it('keeps proof cards available with the normal renderer', () => {
    expect(shouldRenderProofPins(false)).toBe(true);
  });

  it('keeps changing observer rows outside the one-time fallback announcement', () => {
    const initial = renderFallback('Waiting for transaction');
    const changed = renderFallback('3 confirmations');
    expect(initial.match(/role="status"/g)).toHaveLength(1);
    expect(changed.match(/role="status"/g)).toHaveLength(1);
    expect(initial).toContain('aria-label="Live observer status"');
    expect(initial.indexOf('role="status"')).toBeLessThan(initial.indexOf('aria-label="Live observer status"'));
    expect(changed).toContain('3 confirmations');
    expect(changed).toContain('Transaction tracking continues with live observer status.');
  });
});
