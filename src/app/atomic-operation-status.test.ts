import { describe, expect, it } from 'vitest';

import { atomicOperationPreparingLabel, atomicOperationWorkingStatus, operationActivityPhaseLabel } from './App';

describe('atomic operation activity status copy', () => {
	it('does not claim confirmations before a transaction exists', () => {
		expect(atomicOperationWorkingStatus({ workingStatus: '', hasSteps: false, resuming: false })).toBe(
			'Preparing secure wallet approvals…'
		);
	});

	it('reports recovery while resuming a signed transaction without steps', () => {
		expect(atomicOperationWorkingStatus({ workingStatus: '', hasSteps: false, resuming: true })).toBe(
			'Recovering the signed transaction…'
		);
	});

	it('watches confirmations once the transaction has sync steps', () => {
		expect(atomicOperationWorkingStatus({ workingStatus: '', hasSteps: true, resuming: false })).toBe(
			'Watching Arweave confirmations…'
		);
		expect(atomicOperationWorkingStatus({ workingStatus: '', hasSteps: true, resuming: true })).toBe(
			'Watching Arweave confirmations…'
		);
	});

	it('keeps explicit working status (buy lifecycle copy) ahead of the fallbacks', () => {
		for (const hasSteps of [false, true]) {
			for (const resuming of [false, true]) {
				expect(
					atomicOperationWorkingStatus({ workingStatus: 'Five confirmations reached', hasSteps, resuming })
				).toBe('Five confirmations reached');
			}
		}
	});

	it('shares one label with the dialog loading state', () => {
		expect(atomicOperationPreparingLabel(false)).toBe(
			atomicOperationWorkingStatus({ workingStatus: '', hasSteps: false, resuming: false })
		);
		expect(atomicOperationPreparingLabel(true)).toBe(
			atomicOperationWorkingStatus({ workingStatus: '', hasSteps: false, resuming: true })
		);
	});

	it('labels the form phase as not submitted rather than awaiting a signature', () => {
		expect(operationActivityPhaseLabel('form')).toBe('Not submitted');
		expect(operationActivityPhaseLabel('approval')).toBe('Awaiting approval');
		expect(operationActivityPhaseLabel('working')).toBe('In progress');
		expect(operationActivityPhaseLabel('done')).toBe('Complete');
		expect(operationActivityPhaseLabel('error')).toBe('Needs attention');
	});
});
