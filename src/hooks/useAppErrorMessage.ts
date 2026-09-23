import React from 'react';

import {
	type AppError,
	appErrorMessage,
	type AppErrorMessages,
	type AppErrorReason,
	appErrorReasonMessage,
} from 'helpers/app-error';
import { APP_ERROR_MESSAGES } from 'helpers/app-error.messages';
import { useMessages } from 'providers/LanguageProvider';

/** The error copy table resolved for the active language. Pass it to pure model functions that report failures. */
export function useAppErrorMessages(): AppErrorMessages {
	return useMessages(APP_ERROR_MESSAGES);
}

/** Resolves any application error to its user-facing copy. Never display `error.message`. */
export function useAppErrorMessage(): (error: AppError) => string {
	const messages = useAppErrorMessages();
	return React.useCallback((error: AppError) => appErrorMessage(messages, error), [messages]);
}

/** Resolves a reason on its own, for validation copy shown before any error is thrown. */
export function useAppErrorReasonMessage(): (reason: AppErrorReason) => string {
	const messages = useAppErrorMessages();
	return React.useCallback((reason: AppErrorReason) => appErrorReasonMessage(messages, reason), [messages]);
}
