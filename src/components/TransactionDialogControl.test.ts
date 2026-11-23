import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import {
	isTransactionActivityVisible,
	transactionActivityHeading,
	TransactionDialogControl,
	transactionDialogDismissAction,
	transactionDialogHideMotion,
	transactionDialogHideTarget,
} from './TransactionDialogControl';

describe('shared transaction dialog control', () => {
	it('keeps a saved purchase awaiting approval in transaction activity and drops only finished work', () => {
		expect(isTransactionActivityVisible('approval')).toBe(true);
		expect(isTransactionActivityVisible('done')).toBe(false);
		expect(isTransactionActivityVisible('form')).toBe(true);
		expect(isTransactionActivityVisible('working')).toBe(true);
		expect(isTransactionActivityVisible('error')).toBe(true);
	});

	it('closes an approval dialog for later so the activity menu stays its way back', () => {
		expect(transactionDialogDismissAction('approval', false)).toEqual({
			kind: 'close',
			refresh: true,
			resumeLater: true,
		});
		// Atomic and fungible menus filter with the same rule; a restored approval in either survives it.
		const restored = [
			{ id: 'atomic:asset-1:owner', phase: 'approval' as const },
			{ id: 'fungible:token-1:owner:buy', phase: 'approval' as const },
			{ id: 'atomic:asset-2:owner', phase: 'done' as const },
		];
		expect(
			restored.filter((activity) => isTransactionActivityVisible(activity.phase)).map((activity) => activity.id)
		).toEqual(['atomic:asset-1:owner', 'fungible:token-1:owner:buy']);
	});

	it('heads the activity menu with the work that needs the user first', () => {
		expect(transactionActivityHeading({ uploadAttention: 0, approval: 1, working: 0 })).toBe(
			'1 needs your approval'
		);
		expect(transactionActivityHeading({ uploadAttention: 0, approval: 2, working: 3 })).toBe(
			'2 need your approval'
		);
		expect(transactionActivityHeading({ uploadAttention: 1, approval: 2, working: 3 })).toBe(
			'1 upload needs attention'
		);
		expect(transactionActivityHeading({ uploadAttention: 2, approval: 0, working: 0 })).toBe(
			'2 uploads need attention'
		);
		expect(transactionActivityHeading({ uploadAttention: 0, approval: 0, working: 3 })).toBe(
			'3 running in the background'
		);
		expect(transactionActivityHeading({ uploadAttention: 0, approval: 0, working: 0 })).toBe(
			'No transactions running'
		);
	});

	it('hides working transactions without closing their lifecycle', () => {
		expect(transactionDialogDismissAction('working', true)).toEqual({ kind: 'hide' });
		const markup = renderToStaticMarkup(
			React.createElement(TransactionDialogControl, {
				phase: 'working',
				onClick: () => undefined,
			})
		);
		expect(markup).toContain('aria-label="Hide transaction details"');
		expect(markup).toContain('transaction-hide-eye-open');
		expect(markup).toContain('transaction-hide-eye-closed');
		expect(markup).not.toContain('role="tooltip"');
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
			})
		);
		expect(markup).toContain('aria-label="Close dialog"');
		expect(markup).not.toContain('transaction-hide-eye-open');
		expect(markup).not.toContain('role="tooltip"');
	});

	it('shrinks toward the measured transaction activity control', () => {
		expect(
			transactionDialogHideMotion(
				{ left: 100, top: 100, width: 1_000, height: 800 },
				{ left: 1_200, top: 20, width: 36, height: 36 }
			)
		).toEqual({ x: 618, y: -462, scale: 0.036 });
	});

	it('keeps a scroll-locked sticky-header target inside the visible viewport', () => {
		expect(
			transactionDialogHideTarget(
				{ left: 1_824, top: -49, width: 49, height: 36 },
				{ width: 2_052, height: 1_142 }
			)
		).toEqual({ left: 1_824, top: 12, width: 49, height: 36 });
	});
});
