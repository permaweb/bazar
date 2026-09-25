import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import TransactionDialogControl, {
	isTransactionActivityVisible,
	transactionDialogDismissAction,
	transactionDialogHideMotion,
	transactionDialogHideTarget,
} from 'components/molecules/TransactionDialogControl/TransactionDialogControl';
import { OPERATIONS_MESSAGES } from 'features/Operations/messages';

const language = OPERATIONS_MESSAGES.en;

describe('shared transaction dialog control', () => {
	it('keeps wallet approval out of background transaction activity', () => {
		expect(isTransactionActivityVisible('approval')).toBe(false);
		expect(isTransactionActivityVisible('done')).toBe(false);
		expect(isTransactionActivityVisible('form')).toBe(true);
		expect(isTransactionActivityVisible('working')).toBe(true);
		expect(isTransactionActivityVisible('error')).toBe(true);
	});

	it('hides working transactions without closing their lifecycle', () => {
		expect(transactionDialogDismissAction('working', true)).toEqual({ kind: 'hide' });
		const markup = renderToStaticMarkup(
			React.createElement(TransactionDialogControl, {
				closeLabel: language.operationDialogClose,
				hideLabel: language.operationDialogHideTransaction,
				phase: 'working',
				onClick: () => undefined,
			})
		);
		expect(markup).toContain(`aria-label="${language.operationDialogHideTransaction}"`);
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
				closeLabel: language.operationDialogClose,
				hideLabel: language.operationDialogHideTransaction,
				phase: 'done',
				onClick: () => undefined,
			})
		);
		expect(markup).toContain(`aria-label="${language.operationDialogClose}"`);
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
