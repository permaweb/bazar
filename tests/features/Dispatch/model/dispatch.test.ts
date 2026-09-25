import { describe, expect, it } from 'vitest';

import { DISPATCH_SIGNED_TRANSACTION_RECOVERY_REQUIRED, type DispatchPlan } from 'api/dispatch';
import { type AssetState, DISPLAY_STATE_TIMEOUT_ERROR } from 'api/marketplace';

import { DISPATCH_MESSAGES } from 'features/Dispatch/messages';
import {
	dispatchActivityChange,
	dispatchErrorMessage,
	dispatchPlanProgress,
	dispatchProgressStatus,
	dispatchReducer,
	dispatchRunError,
	dispatchSenderBalance,
	dispatchStartStatus,
	dispatchState,
	formatDispatchTokenAmount,
	holderDispatchQuote,
	holderDispatchReady,
	shortAddress,
	tokenPagePath,
} from 'features/Dispatch/model/dispatch';
import type { PluralFormatter } from 'features/Dispatch/types';
import { appError } from 'helpers/app-error';
import { APP_ERROR_MESSAGES } from 'helpers/app-error.messages';
import { DEFAULT_LANGUAGE, formatPlural } from 'helpers/i18n';

const messages = DISPATCH_MESSAGES.en;
const plural: PluralFormatter = (message, count, values) => formatPlural(DEFAULT_LANGUAGE, message, count, values);

const PROCESS = 'P'.repeat(43);
const SENDER = 'S'.repeat(43);
const ALICE = 'A'.repeat(43);
const BOB = 'B'.repeat(43);

function plan(statuses: Array<'unsent' | 'posted' | 'settled'>): DispatchPlan {
	const addresses = [ALICE, BOB, 'C'.repeat(43)];
	return {
		processId: PROCESS,
		sender: SENDER,
		createdAt: 1,
		baseline: Object.fromEntries(statuses.map((_, index) => [addresses[index], '0'])),
		rows: statuses.map((status, index) => ({ address: addresses[index], quantity: '1', status })),
	};
}

function token(overrides: Partial<AssetState> = {}): AssetState {
	return {
		ticker: 'SIG',
		denomination: 2,
		holderBalancesAvailable: true,
		balances: { [SENDER]: '123456' },
		orders: [],
		...overrides,
	} as unknown as AssetState;
}

describe('dispatch recovery errors', () => {
	it('explains why a missing signed transaction requires manual review instead of replacement', () => {
		const message = dispatchErrorMessage(
			new Error(DISPATCH_SIGNED_TRANSACTION_RECOVERY_REQUIRED),
			messages,
			APP_ERROR_MESSAGES.en
		);

		expect(message).toContain('may already have reached Arweave');
		expect(message).toContain('will not sign a replacement');
		expect(message).toContain('manual review');
	});

	it('explains that a state-read deadline cannot create another signature', () => {
		const message = dispatchErrorMessage(new Error(DISPLAY_STATE_TIMEOUT_ERROR), messages, APP_ERROR_MESSAGES.en);

		expect(message).toContain('within 45 seconds');
		expect(message).toContain('No new transfer was signed');
		expect(message).toContain('saved dispatch progress remains available');
	});

	it('falls back to the dispatch copy for unknown failures', () => {
		expect(dispatchErrorMessage(new Error('socket hang up'), messages, APP_ERROR_MESSAGES.en)).toBe(
			'Dispatch failed.'
		);
		expect(
			dispatchErrorMessage(appError('asset-purchase-insufficient-funds'), messages, APP_ERROR_MESSAGES.en)
		).toBe(messages.dispatchErrorInsufficientFunds);
	});
});

describe('dispatch formatting', () => {
	it('shortens addresses and groups whole token digits', () => {
		expect(shortAddress(ALICE)).toBe('AAAAAA…AAAAAA');
		expect(formatDispatchTokenAmount('123456789', { denomination: 2, ticker: 'SIG' }, messages)).toBe(
			'1,234,567.89 SIG'
		);
		expect(formatDispatchTokenAmount('100', { denomination: 0, ticker: '' }, messages)).toBe('100 tokens');
		expect(tokenPagePath(PROCESS)).toContain(`/${PROCESS}`);
	});

	it('reads the sender balance only from complete holder state', () => {
		expect(dispatchSenderBalance(null, SENDER)).toEqual({ balanceStateAvailable: false, balance: null });
		expect(dispatchSenderBalance(token(), null).balance).toBeNull();
		expect(dispatchSenderBalance(token({ holderBalancesAvailable: false }), SENDER)).toEqual({
			balanceStateAvailable: false,
			balance: null,
		});
	});
});

describe('holder dispatch quote', () => {
	it('waits for token state before parsing and for the reward before quoting', () => {
		expect(holderDispatchQuote(`${ALICE},1`, null, 10n).parsed).toBeNull();
		const unpriced = holderDispatchQuote(`${ALICE},1`, { denomination: 0 }, null);
		expect(unpriced.parsed?.rows).toEqual([{ address: ALICE, quantity: '1' }]);
		expect(unpriced.estimate).toBeNull();
		expect(holderDispatchQuote('   ', { denomination: 0 }, 10n).parsed).toBeNull();
	});

	it('quotes network rewards per recipient and requires approval above 0.1 AR', () => {
		const cheap = holderDispatchQuote(`${ALICE},1\n${BOB},2`, { denomination: 0 }, 10n);
		expect(cheap.estimate).toEqual({ totalQuantity: 3n, totalReward: 20n, totalWinston: 20n });
		expect(cheap.needsCostApproval).toBe(false);
		expect(cheap.batchSize).toBeGreaterThan(0);
		expect(holderDispatchReady(cheap, false)).toBe(true);

		const expensive = holderDispatchQuote(`${ALICE},1`, { denomination: 0 }, 100_000_000_001n);
		expect(expensive.needsCostApproval).toBe(true);
		expect(holderDispatchReady(expensive, false)).toBe(false);
		expect(holderDispatchReady(expensive, true)).toBe(true);
	});

	it('refuses to sign a list with parse errors', () => {
		const invalid = holderDispatchQuote(`${ALICE},1.5`, { denomination: 0 }, 10n);
		expect(invalid.parsed?.errors.length).toBeGreaterThan(0);
		expect(holderDispatchReady(invalid, true)).toBe(false);
	});
});

describe('dispatch plan progress', () => {
	it('counts settled and posted rows and detects a sender mismatch', () => {
		expect(dispatchPlanProgress(null, SENDER)).toEqual({
			settled: 0,
			posted: 0,
			complete: false,
			senderMismatch: false,
		});
		expect(dispatchPlanProgress(plan(['settled', 'posted', 'unsent']), ALICE)).toEqual({
			settled: 1,
			posted: 1,
			complete: false,
			senderMismatch: true,
		});
		expect(dispatchPlanProgress(plan(['settled', 'settled']), null)).toMatchObject({
			complete: true,
			senderMismatch: false,
		});
		expect(dispatchProgressStatus(plan(['settled', 'posted']), messages)).toBe('1 of 2 settled');
		expect(dispatchStartStatus(1, messages, plural)).toBe('Dispatching to 1 holder…');
		expect(dispatchStartStatus(3, messages, plural)).toBe('Dispatching to 3 holders…');
	});

	it('announces a run as a transfer on its dedicated activity id and removes it when done', () => {
		const base = { processId: PROCESS, sender: SENDER, status: '1 of 2 settled', createdAt: 5, messages };
		expect(dispatchActivityChange({ ...base, token: { ticker: 'SIG' }, phase: 'working' })).toMatchObject({
			type: 'upsert',
			activity: {
				id: `fungible:${PROCESS}:${SENDER}:dispatch`,
				asset: { id: PROCESS, name: 'SIG', ticker: 'SIG' },
				owner: SENDER,
				operationKind: 'transfer',
				phase: 'working',
				status: { text: '1 of 2 settled' },
				createdAt: 5,
			},
		});
		const unnamed = dispatchActivityChange({ ...base, token: null, phase: 'error' });
		expect(unnamed.type === 'upsert' ? unnamed.activity.asset : null).toEqual({
			id: PROCESS,
			name: messages.dispatchActivityFallbackName,
		});
		expect(dispatchActivityChange({ ...base, token: null, phase: 'done' })).toEqual({
			type: 'remove',
			id: `fungible:${PROCESS}:${SENDER}:dispatch`,
			owner: SENDER,
		});
	});
});

describe('dispatch run state machine', () => {
	it('runs a created plan to completion', () => {
		const created = plan(['unsent', 'unsent']);
		let state = dispatchReducer(dispatchState(null), { type: 'plan-created', plan: created });
		state = dispatchReducer(state, { type: 'run-started' });
		expect(state).toEqual({ plan: created, run: { status: 'running' } });
		const progressed = plan(['settled', 'posted']);
		state = dispatchReducer(state, { type: 'progressed', plan: progressed });
		expect(state.plan).toBe(progressed);
		state = dispatchReducer(state, { type: 'run-settled' });
		expect(state.run).toEqual({ status: 'idle' });
	});

	it('keeps a run failure visible after the run settles and clears it on the next edit or run', () => {
		let state = dispatchReducer(dispatchState(plan(['unsent'])), { type: 'run-started' });
		state = dispatchReducer(state, { type: 'failed', error: 'Dispatch failed.' });
		state = dispatchReducer(state, { type: 'run-settled' });
		expect(dispatchRunError(state.run)).toBe('Dispatch failed.');
		expect(dispatchReducer(state, { type: 'error-cleared' }).run).toEqual({ status: 'idle' });
		expect(dispatchReducer(state, { type: 'run-started' }).run).toEqual({ status: 'running' });
	});

	it('records a pre-flight failure without a plan', () => {
		const state = dispatchReducer(dispatchState(null), { type: 'failed', error: 'No balance' });
		expect(state).toEqual({ plan: null, run: { status: 'failed', error: 'No balance' } });
	});

	it('ignores discards and stray transitions that do not apply', () => {
		const running = dispatchReducer(dispatchState(plan(['unsent'])), { type: 'run-started' });
		expect(dispatchReducer(running, { type: 'discarded' })).toBe(running);
		expect(dispatchReducer(running, { type: 'run-started' })).toBe(running);
		expect(dispatchReducer(running, { type: 'error-cleared' })).toBe(running);
		const idle = dispatchState(plan(['unsent']));
		expect(dispatchReducer(idle, { type: 'run-settled' })).toBe(idle);
		expect(dispatchReducer(idle, { type: 'discarded' })).toEqual({ plan: null, run: { status: 'idle' } });
	});
});
