import React from 'react';

import {
	DEFAULT_LANGUAGE,
	formatPlural,
	type Language,
	type MessageCatalog,
	type Messages,
	type MessageValues,
	type PluralMessage,
	resolveMessages,
} from 'helpers/i18n';

interface LanguageContextState {
	language: Language;
}

// Components rendered outside the provider (isolated tests, portals) read the default language.
const DEFAULT_CONTEXT: LanguageContextState = { language: DEFAULT_LANGUAGE };

const LanguageContext = React.createContext<LanguageContextState>(DEFAULT_CONTEXT);

export default function LanguageProvider(props: { children: React.ReactNode }) {
	return <LanguageContext.Provider value={DEFAULT_CONTEXT}>{props.children}</LanguageContext.Provider>;
}

export function useLanguageProvider(): LanguageContextState {
	return React.useContext(LanguageContext);
}

export function useMessages<T extends Messages>(catalog: MessageCatalog<T>): T {
	const language = useLanguageProvider().language;
	return React.useMemo(() => resolveMessages(catalog, language), [catalog, language]);
}

export function usePlural(): (message: PluralMessage, count: number, values?: MessageValues) => string {
	const language = useLanguageProvider().language;
	return React.useCallback(
		(message: PluralMessage, count: number, values?: MessageValues) =>
			formatPlural(language, message, count, values),
		[language]
	);
}
