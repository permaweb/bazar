export const LANGUAGES = ['en'] as const;

export type Language = (typeof LANGUAGES)[number];

export const DEFAULT_LANGUAGE: Language = 'en';

export type PluralMessage = {
	readonly one: string;
	readonly other: string;
	readonly zero?: string;
	readonly two?: string;
	readonly few?: string;
	readonly many?: string;
};

export type Message = string | PluralMessage;

export type Messages = { readonly [key: string]: Message };

// English is the source catalog; other languages may translate a subset and fall back to it.
export type MessageCatalog<T extends Messages> = { readonly en: T } & {
	readonly [L in Exclude<Language, 'en'>]?: Partial<T>;
};

export type MessageValues = Readonly<Record<string, string | number>>;

const PLACEHOLDER = /\{(\w+)\}/g;
const pluralRules = new Map<Language, Intl.PluralRules>();

export function defineMessages<T extends Messages>(catalog: MessageCatalog<T>): MessageCatalog<T> {
	return catalog;
}

export function isLanguage(value: unknown): value is Language {
	return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

export function resolveMessages<T extends Messages>(catalog: MessageCatalog<T>, language: Language): T {
	const translated = (catalog as Partial<Record<Language, Partial<T>>>)[language];
	if (language === DEFAULT_LANGUAGE || !translated) return catalog.en;
	return { ...catalog.en, ...translated };
}

// Replaces `{name}` placeholders. Unknown placeholders stay visible so missing values fail loudly in tests.
export function formatMessage(template: string, values?: MessageValues): string {
	if (!values) return template;
	return template.replace(PLACEHOLDER, (placeholder, name: string) =>
		Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : placeholder
	);
}

export function formatPlural(
	language: Language,
	message: PluralMessage,
	count: number,
	values?: MessageValues
): string {
	let rules = pluralRules.get(language);
	if (!rules) {
		rules = new Intl.PluralRules(language);
		pluralRules.set(language, rules);
	}
	const category = count === 0 && message.zero !== undefined ? 'zero' : rules.select(count);
	const template = message[category as keyof PluralMessage] ?? message.other;
	return formatMessage(template, { count, ...values });
}
