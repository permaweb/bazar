import { describe, expect, it } from 'vitest';

import { SAVED_ACTION_CHECK_FAILED_NOTICE, savedActionCheckNotice } from './App';

const paused =
	'A previous purchase is paused because its order is no longer available to this wallet. Its signed transaction details remain saved in this browser, and no replacement payment will be created.';

describe('saved-action check notice', () => {
	it('reports a failed check instead of skipping it silently', () => {
		expect(savedActionCheckNotice('', 'failed')).toBe(SAVED_ACTION_CHECK_FAILED_NOTICE);
		expect(SAVED_ACTION_CHECK_FAILED_NOTICE).toContain('checked again when the asset refreshes');
	});

	it('keeps a notice the same check already set and adds the failure once', () => {
		const failed = savedActionCheckNotice(paused, 'failed');
		expect(failed).toBe(`${paused} ${SAVED_ACTION_CHECK_FAILED_NOTICE}`);
		expect(savedActionCheckNotice(failed, 'failed')).toBe(failed);
		expect(savedActionCheckNotice(SAVED_ACTION_CHECK_FAILED_NOTICE, 'failed')).toBe(
			SAVED_ACTION_CHECK_FAILED_NOTICE
		);
	});

	it('clears only the failure once a later check completes', () => {
		expect(savedActionCheckNotice(SAVED_ACTION_CHECK_FAILED_NOTICE, 'checked')).toBe('');
		expect(savedActionCheckNotice(`${paused} ${SAVED_ACTION_CHECK_FAILED_NOTICE}`, 'checked')).toBe(paused);
		expect(savedActionCheckNotice(paused, 'checked')).toBe(paused);
		expect(savedActionCheckNotice('', 'checked')).toBe('');
	});
});
