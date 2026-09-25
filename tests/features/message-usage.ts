import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

import type { Message, Messages } from 'helpers/i18n';

// Reads how a feature actually uses its message catalog, so each catalog test can assert that every key resolves,
// that no message is left unrendered, and that interpolation passes exactly the placeholders a template declares.

const PLACEHOLDER = /\{(\w+)\}/g;
/** The resolved-catalog variable name features use (`useMessages(...)`, or a `messages` parameter in `model/`). */
const CATALOG_IDENTIFIER = /(?:^|\.)(?:messages|language)$/;
/** Interpolation helpers, mapped to the argument positions of their template and their values object. */
const FORMATTERS: Readonly<Record<string, { template: number; values: number }>> = {
	formatMessage: { template: 0, values: 1 },
	plural: { template: 0, values: 2 },
	formatPlural: { template: 1, values: 3 },
};

export type CatalogUsage = {
	/** Every catalog key the feature reads, directly or through a key literal. */
	keys: Set<string>;
	/** Catalog keys the feature never reads. */
	unused: string[];
	/** Keys the feature reads that the catalog does not define. */
	unknown: string[];
	/** Templates whose declared placeholders are not all supplied at a call site. */
	placeholderMismatches: string[];
};

type CallSite = { file: string; line: number; key: string; values: string[] | null };

function sourceFiles(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const entryPath = path.join(directory, entry.name);
		if (entry.isDirectory()) return sourceFiles(entryPath);
		return /\.tsx?$/.test(entry.name) && entry.name !== 'messages.ts' ? [entryPath] : [];
	});
}

/** The catalog keys an expression can resolve to; a ternary between two messages resolves to both. */
function catalogKeys(node: ts.Expression | undefined): string[] {
	if (!node) return [];
	if (ts.isConditionalExpression(node)) return [...catalogKeys(node.whenTrue), ...catalogKeys(node.whenFalse)];
	if (ts.isParenthesizedExpression(node)) return catalogKeys(node.expression);
	if (!ts.isPropertyAccessExpression(node)) return [];
	return CATALOG_IDENTIFIER.test(node.expression.getText()) ? [node.name.text] : [];
}

/** Value names an object literal passes, or `null` when a spread or computed name makes them unknowable. */
function valueNames(node: ts.Expression | undefined): string[] | null {
	if (!node || !ts.isObjectLiteralExpression(node)) return null;
	const names: string[] = [];
	for (const property of node.properties) {
		if (!property.name || !(ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))) return null;
		names.push(property.name.text);
	}
	return names;
}

function placeholders(message: Message): string[] {
	const templates = typeof message === 'string' ? [message] : Object.values(message);
	const found = new Set<string>();
	for (const template of templates) {
		for (const match of (template ?? '').matchAll(PLACEHOLDER)) found.add(match[1]);
	}
	return [...found].sort();
}

/** Scan one feature directory for how it reads and interpolates its catalog. */
export function catalogUsage(featureRoot: string, catalog: Messages): CatalogUsage {
	const keys = new Set<string>();
	const interpolated = new Set<string>();
	const calls: CallSite[] = [];
	const defined = new Set(Object.keys(catalog));

	for (const file of sourceFiles(path.resolve(featureRoot))) {
		const relative = path.relative(process.cwd(), file).split(path.sep).join('/');
		const source = ts.createSourceFile(
			file,
			readFileSync(file, 'utf8'),
			ts.ScriptTarget.Latest,
			true,
			file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
		);
		const visit = (node: ts.Node) => {
			if (ts.isPropertyAccessExpression(node)) {
				for (const key of catalogKeys(node)) keys.add(key);
			} else if (ts.isStringLiteral(node) && defined.has(node.text)) {
				// A key held in a literal lookup table (`labelKey: 'udlPresetOpenUseLabel'`) is read indirectly.
				keys.add(node.text);
			} else if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
				const positions = FORMATTERS[node.expression.text];
				const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
				const values = positions ? valueNames(node.arguments[positions.values]) : null;
				for (const key of positions ? catalogKeys(node.arguments[positions.template]) : []) {
					interpolated.add(key);
					calls.push({ file: relative, line, key, values });
				}
			}
			ts.forEachChild(node, visit);
		};
		visit(source);
	}

	return {
		keys,
		unknown: [...keys].filter((key) => !defined.has(key)).sort(),
		unused: [...defined].filter((key) => !keys.has(key)).sort(),
		placeholderMismatches: [
			// A template with placeholders must reach a formatter; rendered directly it would show `{name}` to the user.
			...[...keys]
				.filter((key) => defined.has(key) && placeholders(catalog[key]).length && !interpolated.has(key))
				.sort()
				.map((key) => `${key} declares {${placeholders(catalog[key]).join(', ')}} but is never interpolated`),
			...calls.flatMap((call) => {
				const message = catalog[call.key];
				if (!message || call.values === null) return [];
				// `formatPlural` supplies `count` itself; a shared values object may also carry more than one
				// branch of a ternary needs, so only a placeholder with no value is a defect.
				const passed = new Set([...call.values, ...(typeof message === 'string' ? [] : ['count'])]);
				const missing = placeholders(message).filter((name) => !passed.has(name));
				return missing.length
					? [`${call.file}:${call.line} ${call.key} declares {${missing.join(', ')}} with no value passed`]
					: [];
			}),
		],
	};
}
