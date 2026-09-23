import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import type { Message, Messages } from 'helpers/i18n';

const PLACEHOLDER = /\{(\w+)\}/g;
const MESSAGE_ACCESS = /\bmessages\.([A-Za-z0-9_]+)/g;
// `formatMessage(messages.key, { … })` and `plural(messages.key, count, { … })`: the values the code supplies.
const FORMAT_CALL = /\b(?:formatMessage|plural)\(\s*messages\.([A-Za-z0-9_]+)\s*,([^{}]*)\{([^{}]*)\}\s*\)/g;
const VALUE_NAME = /(?:^|,)\s*([A-Za-z0-9_]+)\s*(?::|,|$)/g;

function featureSources(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const entryPath = path.join(directory, entry.name);
		if (entry.isDirectory()) return featureSources(entryPath);
		return /\.tsx?$/.test(entry.name) && entry.name !== 'messages.ts' ? [entryPath] : [];
	});
}

/** Every placeholder name a template declares, such as `count` in `'{count} events'`. */
export function templatePlaceholders(template: string): string[] {
	return [...template.matchAll(PLACEHOLDER)].map((match) => match[1]);
}

function messagePlaceholders(message: Message): string[] {
	if (typeof message === 'string') return templatePlaceholders(message);
	return [...new Set(Object.values(message).flatMap((template) => templatePlaceholders(template)))];
}

export type CatalogUsage = {
	/** Catalog keys the feature's own code reads. */
	keys: string[];
	/** Value names the feature passes to `formatMessage`/`plural`, by catalog key. */
	values: Map<string, string[]>;
};

/** Reads one feature's sources and reports which catalog entries it uses and what it interpolates into them. */
export function catalogUsage(featureRoot: string): CatalogUsage {
	const sources = featureSources(path.resolve(featureRoot)).map((file) => readFileSync(file, 'utf8'));
	const keys = new Set<string>();
	const values = new Map<string, string[]>();
	for (const source of sources) {
		for (const match of source.matchAll(MESSAGE_ACCESS)) keys.add(match[1]);
		for (const match of source.matchAll(FORMAT_CALL)) {
			const supplied = [...match[3].matchAll(VALUE_NAME)].map((value) => value[1]);
			values.set(match[1], [...new Set([...(values.get(match[1]) ?? []), ...supplied])]);
		}
	}
	return { keys: [...keys].sort(), values };
}

/** Catalog keys the code reads that the catalog does not define. */
export function missingKeys(usage: CatalogUsage, catalog: Messages): string[] {
	return usage.keys.filter((key) => !Object.prototype.hasOwnProperty.call(catalog, key));
}

/** Placeholders a template declares that its call sites never supply, as `key: placeholder` pairs. */
export function unsuppliedPlaceholders(usage: CatalogUsage, catalog: Messages): string[] {
	return [...usage.values].flatMap(([key, supplied]) => {
		const message = catalog[key];
		if (message === undefined) return [];
		// `formatPlural` supplies `count` itself, so a plural template never needs it passed in.
		const implicit = typeof message === 'string' ? [] : ['count'];
		return messagePlaceholders(message)
			.filter((placeholder) => !implicit.includes(placeholder) && !supplied.includes(placeholder))
			.map((placeholder) => `${key}: ${placeholder}`);
	});
}

/** Values a call site supplies that the template never names, as `key: value` pairs. */
export function unusedValues(usage: CatalogUsage, catalog: Messages): string[] {
	return [...usage.values].flatMap(([key, supplied]) => {
		const message = catalog[key];
		if (message === undefined) return [];
		const placeholders = messagePlaceholders(message);
		return supplied.filter((value) => !placeholders.includes(value)).map((value) => `${key}: ${value}`);
	});
}
