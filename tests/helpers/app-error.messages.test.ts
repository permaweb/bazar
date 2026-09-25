import { describe, expect, it } from 'vitest';

import { APP_ERROR_REASON_LIST, appError, appErrorReasonMessage } from 'helpers/app-error';
import { APP_ERROR_MESSAGES } from 'helpers/app-error.messages';
import { DEFAULT_LANGUAGE, LANGUAGES, resolveMessages } from 'helpers/i18n';

const PLACEHOLDER = /\{(\w+)\}/g;

describe('application error message catalog', () => {
	it('defines copy for every reason in every language', () => {
		for (const language of LANGUAGES) {
			const resolved = resolveMessages(APP_ERROR_MESSAGES, language);
			expect(Object.keys(resolved).sort()).toEqual([...APP_ERROR_REASON_LIST].sort());
			for (const reason of APP_ERROR_REASON_LIST) {
				expect(typeof resolved[reason], reason).toBe('string');
				expect((resolved[reason] as string).trim(), reason).not.toBe('');
			}
		}
	});

	it('keeps each category entry as the generic copy its code-named reason resolves', () => {
		const resolved = resolveMessages(APP_ERROR_MESSAGES, DEFAULT_LANGUAGE);
		for (const reason of APP_ERROR_REASON_LIST) {
			expect(appErrorReasonMessage(resolved, reason), reason).toBe(resolved[reason]);
			expect(appErrorReasonMessage(resolved, appError(reason).code), reason).toBe(
				resolved[appError(reason).code]
			);
		}
	});

	it('names no placeholder, because reason copy is never interpolated', () => {
		const resolved = resolveMessages(APP_ERROR_MESSAGES, DEFAULT_LANGUAGE);
		const withPlaceholders = Object.entries(resolved).filter(([, message]) => PLACEHOLDER.test(message as string));
		expect(withPlaceholders.map(([key]) => key)).toEqual([]);
	});

	it('never shows a reason code as copy', () => {
		const resolved = resolveMessages(APP_ERROR_MESSAGES, DEFAULT_LANGUAGE);
		for (const reason of APP_ERROR_REASON_LIST) {
			expect(resolved[reason], reason).not.toMatch(/^[a-z]+(?:-[a-z0-9]+)+$/);
		}
	});
});
