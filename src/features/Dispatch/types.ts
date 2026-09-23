import type { MessageValues, PluralMessage } from 'helpers/i18n';

/** The plural formatter `usePlural()` returns, passed into pure model helpers so they stay React-independent. */
export type PluralFormatter = (message: PluralMessage, count: number, values?: MessageValues) => string;
