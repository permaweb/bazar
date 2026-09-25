import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import type { MessageCatalog, Messages } from 'helpers/i18n';

const PLACEHOLDER = /\{(\w+)\}/g;

/** Every source file of an area that owns a catalog, concatenated; the catalog itself is left out. */
export function catalogSourceText(directory: string): string {
	return readdirSync(directory, { withFileTypes: true })
		.flatMap((entry) => {
			const entryPath = path.join(directory, entry.name);
			if (entry.isDirectory()) return [catalogSourceText(entryPath)];
			if (entry.name === 'messages.ts' || !/\.tsx?$/.test(entry.name)) return [];
			return [readFileSync(entryPath, 'utf8')];
		})
		.join('\n');
}

/** Catalog keys the area never mentions: copy that no longer ships, or a key renamed in one place only. */
export function unusedCatalogKeys<T extends Messages>(catalog: MessageCatalog<T>, source: string): string[] {
	return Object.keys(catalog.en).filter((key) => !new RegExp(`\\b${key}\\b`).test(source));
}

/**
 * Placeholder names a template asks for that the area never names. `count` is excluded for plural messages because
 * `formatPlural` always supplies it.
 */
export function unsuppliedPlaceholders<T extends Messages>(catalog: MessageCatalog<T>, source: string): string[] {
	const missing: string[] = [];
	for (const [key, message] of Object.entries(catalog.en)) {
		const templates = typeof message === 'string' ? [message] : Object.values(message);
		const automatic = typeof message === 'string' ? [] : ['count'];
		for (const template of templates) {
			for (const [, name] of template.matchAll(PLACEHOLDER)) {
				if (automatic.includes(name)) continue;
				if (!new RegExp(`\\b${name}\\b`).test(source)) missing.push(`${key}:{${name}}`);
			}
		}
	}
	return [...new Set(missing)];
}
